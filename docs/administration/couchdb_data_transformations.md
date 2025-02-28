# CouchDB data transformation
Suggested workflow to apply transformations to documents in a CouchDB database

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [0 - environement](#0---environement)
- [1 - Get the documents locally](#1---get-the-documents-locally)
  - [Get all the documents in a database](#get-all-the-documents-in-a-database)
  - [Get only documents emitted by a certain view](#get-only-documents-emitted-by-a-certain-view)
  - [Get only documents emitted by a certain view for a certain key](#get-only-documents-emitted-by-a-certain-view-for-a-certain-key)
- [2 - Apply transformation](#2---apply-transformation)
  - [By modifying the document as a JS object](#by-modifying-the-document-as-a-js-object)
  - [By modifying the document as text](#by-modifying-the-document-as-text)
- [3 - Post back in bulk](#3---post-back-in-bulk)
- [4 - Check for conflicts](#4---check-for-conflicts)
- [Examples](#examples)
  - [Delete tasks documents in bulk](#delete-tasks-documents-in-bulk)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## 0 - environement

```sh
db_host="http://${db_username}:${db_password}@localhost:5984"
curljson () {
  curl -s -H "Content-Type: application/json" -H 'Accept: application/json' $@
}
```

## 1 - Get the documents locally
In this first step we get all the documents that will need to be edited in a single newline-delimited JSON dump file, that is with one document per line. This format makes the transformation and reupload easier.

### Get all the documents in a database
```sh
# All 'users' database documents
curl "$db_host/users/_all_docs?include_docs=true" | jq '.rows[] | .doc' -c > documents.ndjson
```

### Get only documents emitted by a certain view
```sh
# All documents emitted by the 'byUsername' view from the 'users' design doc, from the 'users' database
curl "$db_host/users/_design/users/_view/byUsername" | jq '.rows[] | .doc' -c > documents.ndjson
```

### Get only documents emitted by a certain view for a certain key
```sh
# Get only documents matching the keys 'foo' and 'bar' in the 'byUsername' view
curljson "$db_host/users/_design/users/_view/byUsername?include_docs=true" -d '{"keys":["foo","bar"]}' | jq '.rows[] | .doc' -c > documents.ndjson
```

For more complex keys, curl alone can get painful, as CouchDB expects a valid JSON object. It could then be easier to use a tool such as [`couchdb-view-by-keys`](https://github.com/maxlath/couchdb-view-by-keys) `>= v4`:
```sh
# The same query as above with couchdb-view-by-keys. Notice that include_docs=true is the default now, and that we directly get NDJSON
couchdb-view-by-keys --docs "$db_host/users/_design/users/_view/byUsername" 'foo' 'bar' > documents.ndjson
# This really shines when your keys get more complex: hereafter, we get all documents with the claims
couchdb-view-by-keys --docs "$db_host/entities/_design/entities/_view/byClaim" '["wdt:P31", "wd:Q5"]' > documents.ndjson
```

## 2 - Apply transformation
### By modifying the document as a JS object
Here, we use [`ndjson-apply`](https://github.com/maxlath/ndjson-apply) to apply a transformation on all the downloaded documents, using a JS function. Note that for simpler transformations, `jq` would also be an option, see [examples](#examples).

Write your transform function in a file:
```js
// transform_users.js
export default function (doc) {
  doc.language = doc.language || 'en'
  delete doc.picture
  return doc
}
```
(that function could also be async (see [`ndjson-apply` documentation](https://github.com/maxlath/ndjson-apply)))

You can test the effects of your function by using `ndjson-apply` `--diff` mode:

```sh
# Preview the transformation on all the documents
cat ./documents.ndjson | ndjson-apply ./transform_users.js --diff
# or just the first 100 docs
head -n 100 ./documents.ndjson | ndjson-apply ./transform_users.js --diff
```

This can also be done with a TypeScript file using `ndjson-apply` TS executable `ndjson-apply-ts`
```sh
cat ./documents.ndjson | ndjson-apply-ts ./transform_users.ts --diff
```

When the preview gives the expected results, you're ready to transform all your documents!

```sh
cat ./documents.ndjson | ndjson-apply ./transform_users.js > updated_documents.ndjson
```


### By modifying the document as text
In some cases, it's ok to just pass the documents through a `sed` command to replace some bits of the document. It should generally be considered more risky than modifying the JS object, but in some cases, and assuming that you have a good knowledge of the documents you're modifying, that should be just fine.

Example: we have a bunch of patches that use a property that got replaced
```sh
cat patches.ndjson | grep 'wdt:P364' | sed 's/wdt:P364/wdt:P407/' > patches.fixed.ndjson
```
Pros:
- you don't need to get in the different configurations in which patches might be referring to the property `wdt:P364` (adding, updating, deleting)
Cons:
- In the (very unlikely) case there is some text value (an label or a string property) that matches `wdt:P364`, you're modifying data that should not have been modified.

## 3 - Post back in bulk
Those updated documents can be uploaded back to CouchDB with a tool such as [`couchdb-bulk2`](https://github.com/maxlath/couchdb-bulk2)

```sh
cat updated_documents.ndjson | couchdb-bulk2 "$db_host/users"
```

## 4 - Check for conflicts
```sh
grep conflict update.errors
```

## Examples

### Delete tasks documents in bulk
```sh
curljson "$db_host/tasks/_design/tasks/_view/byEntitiesType?include_docs=true" -d '{"key":"human"}' | jq '.rows[].doc | { _id: ._id, _rev: ._rev, _deleted: true }' -cr > docs_to_delete.ndjson
cat docs_to_delete.ndjson | couchdb-bulk2 "$db_host/tasks"
```
