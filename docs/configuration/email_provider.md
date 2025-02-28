# External email provider

Inventaire must send email to confirm account creation, and may send email notifications and activity summaries, dependending on users preferences. A mailer service is also optional to send the automatic newsletter.

## In production

### About the email server provider

Any service providing an SMTP server may fit. For your information, inventaire.io is using Sendgrid, but one you could also set up their own service for handling emails, with an open source tool like [Postal](https://docs.postalserver.io/), [like our friends at Karrot do](https://blog.karrot.world/2019/09/25/setting-up-email-service.html).

### Setup the inventaire config

In `config/local.cjs`:

```js
module.exports = {
  ...
  mailer: {
    disabled: false,
    nodemailer: {
      host: 'smtp.provider-domain.org',
      // Conventional port (587) may be customized
      port: 587,
      auth: {
        user: 'your-provider-username',
        pass: 'your-provider-password'
      },
    },
  }
  ...
}
```

### Test the service

Once setup, on may send a test email with the following command:

```sh
npm run send-test-email your@email.org
```

## In development

To test the rendering of your email in development, you can create an account on [ethereal](https://ethereal.email/create), and update your local config (`config/local.cjs`) accordingly:

```js
module.exports = {
  ...
  mailer: {
    disabled: false,
    nodemailer: {
      host: 'smtp.ethereal.email',
      port: 587,
      // Input the username and password you got at https://ethereal.email/create
      auth: {
        user: 'someusername@ethereal.email',
        pass: 'somepassword',
      },
    },
  }
  ...
}
```