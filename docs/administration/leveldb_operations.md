# LevelDB operations

Hereafter, `lev` refers to the executable provided by https://github.com/maxlath/lev2, which can be installed with:
```sh
npm i -g lev2
```

## Export
```sh
lev ./db/leveldb > export.ndjson
```

## Import
```sh
lev ./db/leveldb --batch < export.ndjson
```

## Delete entries in bulk

```sh
# Delete all entries with a key starting by '!job:inv:deduplicate' in 2 steps:
# 1 - generate the batch delete operations
# 2 - actually execute those operations
lev ./db/leveldb --prefix '!job:inv:deduplicate' --del | lev ./db/leveldb-dev --batch
```
