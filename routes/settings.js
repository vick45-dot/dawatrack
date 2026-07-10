// Owner-only payment configuration.
const express = require('express');
const router = express.Router();
const settings = require('../services/settings');

const SECRET_FIELDS = ['mpesa.consumer_key', 'mpesa.consumer_secret', 'mpesa.passkey'];

router.get('/', async (req, res, next) => {
  try {
    const s = await settings.getAll();
    res.render('settings', {
      page: 'settings', s,
      hasSecret: {
        key: !!s['mpesa.consumer_key'],
        secret: !!s['mpesa.consumer_secret'],
        passkey: !!s['mpesa.passkey'],
      },
      mp: settings.mpesaConfig(s),
      msg: req.query.msg,
    });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const updates = {};
    for (const m of ['cash', 'mpesa', 'card', 'paypal', 'applepay', 'bank', 'other']) {
      updates[`pay.${m}.enabled`] = b[`pay_${m}`] ? '1' : '0';
    }
    const kind = ['paybill', 'till', 'pochi'].includes(b.mpesa_kind) ? b.mpesa_kind : 'paybill';
    updates['mpesa.kind'] = kind;
    updates['mpesa.shortcode'] = (b.mpesa_shortcode || '').trim();
    updates['mpesa.party_b'] = (b.mpesa_party_b || '').trim();
    updates['mpesa.pochi_phone'] = (b.mpesa_pochi_phone || '').trim();
    updates['mpesa.env'] = b.mpesa_env === 'production' ? 'production' : 'sandbox';
    updates['mpesa.simulate'] = b.mpesa_simulate ? '1' : '0';
    updates['app.public_url'] = (b.public_url || '').trim();
    updates['bank.name'] = (b.bank_name || '').trim();
    updates['bank.account_name'] = (b.bank_account_name || '').trim();
    updates['bank.account_number'] = (b.bank_account_number || '').trim();

    // Secrets: blank input = keep the stored value
    const secretInputs = {
      'mpesa.consumer_key': (b.mpesa_consumer_key || '').trim(),
      'mpesa.consumer_secret': (b.mpesa_consumer_secret || '').trim(),
      'mpesa.passkey': (b.mpesa_passkey || '').trim(),
    };
    for (const [name, val] of Object.entries(secretInputs)) {
      if (val) updates[name] = val;
    }
    if (b.mpesa_clear_credentials) {
      for (const name of SECRET_FIELDS) updates[name] = '';
    }

    await settings.setMany(updates);
    res.redirect('/settings?msg=Settings+saved');
  } catch (err) { next(err); }
});

module.exports = router;
