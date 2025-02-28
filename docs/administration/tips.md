# Tips and tricks to administrate an instance

## Scripts

### Update user role

```sh
npm run db-actions:update-user-role <user id> <action> <role>
```

Possible actions: `add`, `remove`
Possible roles: `admin`, `dataadmin`

See: [Roles and access levels](https://wiki.inventaire.io/wiki/Roles_and_access_levels)

#### Alternative with username

Make a user an admin:

```sh
npm run db-actions:update-user-role-from-username your_username add admin
```

### Prevent sending further emails to an email address

People invited by Inventaire users might not want those emails, or some users might not know where to find email settings. To prevent sending further emails to a given address, run:

```sh
npm run db-actions:stop-emails-to-address <email address>
```

### Increment user undelivered emails count

Allows to take actions (typically, stop sending emails) when an email address has rejecting too many emails already
```sh
npm run db-actions:increment-user-undelivered-emails-count <email address>
```

### Delete user account

Delete a user account in the same way a user could do, namely by also cleaning up other databases:
* delete items, shelves, and notifications
* leave groups
* cancel ongoing transactions

```sh
npm run db-actions:delete-user <user id>
```

## In the application

### Prevent spams

During some events (ie: updating user information, adding book comments, creating lists description), some suspicious keywords can to trigger a report in the user database document.

In `config/local.cjs`:

```js
module.exports = {
  ...
  spam: {
    suspectKeywords: [
      'SEO',
      'marketing',
      'shopping',
    ],
  }
```
Those reports can then be inspected by a user with admin rights at `/users/latest`
