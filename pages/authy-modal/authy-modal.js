import Authy from './authy-modal.html';
import Cleave from 'cleave.js';
import 'cleave.js/dist/addons/cleave-phone.i18n.js';
import countryCodes from '../../js/country-codes.json';
import _ from 'lodash';
import axios from 'axios';
import Isemail from 'isemail';
import env from '../../dev.json';

axios.defaults.baseURL = env.wt;
axios.defaults.headers.common['Content-Type'] = 'application/json';

export default {
  template: Authy,
  props: [
    'lock',
    'authIdToken',
    'authIdTokenPayload',
    'loading',
    'loader',
    'disabled'
  ],
  data() {
    return {
      tfa: JSON.parse(localStorage.getItem('tfa')),
      qrCode: null,

      phone: undefined,
      email: undefined,
      defaultCountryCode: 'US',

      code: null,
    }
  },
  computed: {
    countryCodes() {
      return _
      .chain(countryCodes)
      .filter((countryCode) => countryCode.dial_code)
      .uniqBy('code')
      .value();
    },
    country() {
      const country = _.find(countryCodes, {code: this.defaultCountryCode});
      return country ? country : _.find(countryCodes, {code: 'US'});
    },
    authy() {
      return this.authIdTokenPayload ? this.authIdTokenPayload[env.auth0.scope].authy : null;
    }
  },
  watch: {
    defaultCountryCode() {
      const dial_code = this.country.dial_code.split(' ');

      if (this.phone) {
        this.phone.setRawValue(dial_code[1]);
        this.phone.setPhoneRegionCode(this.defaultCountryCode);
      }
    },
    tfa() {
      this.setCleave();
    }
  },
  filters: {
    dialCode(dial_code) {
      return dial_code.split(' ')[0];
    }
  },
  mounted() {
    this.getAuthyAccount();
    this.setDefaultCountryCode();
    this.setCleave();
  },
  methods: {
    setCleave() {
      if (this.tfa) {
        if (this.phone)
          return this.phone.destroy();
        return;
      }

      this.phone = new Cleave('.input-phone', {
        phone: true,
        phoneRegionCode: this.defaultCountryCode
      });

      this.phone.setRawValue();
    },

    setDefaultCountryCode() {
      axios.get('https://api.ipdata.co')
      .then(({data}) => this.defaultCountryCode = data.country_code)
      .catch((err) => console.error(err));
    },

    focusPhone() {
      document.querySelector('.input-phone').focus();
    },

    setAuthyAccount() {
      const dial_code = this.country.dial_code.split(' ');
      const phone = this.phone.getRawValue();

      if (
        !phone ||
        dial_code[1] &&
        phone.substr(0, dial_code[1].length) !== dial_code[1]
      ) return alert(`Not a ${this.country.name} phone number`);

      if (
        !this.email ||
        !Isemail.validate(this.email)
      ) return alert(`${this.email} is not a valid email address`);

      this.loading.push(1);

      axios.post('set-authy-account', {
        phone: {
          number: phone,
          code: this.country.code,
          dial: dial_code[0]
        },
        email: this.email
      }, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(() => {
        this.lock.checkSession({scope: 'openid profile email'}, (err, authResult) => {
          if (err) {
            console.error(err);
            return;
          }

          this.$emit('lockAuthenticated', authResult);
          this.getAuthyAccount();
        });
      })
      .catch((err) => console.error(err))
      .finally(() => this.loading.pop());
    },

    getAuthyAccount() {
      this.loading.push(1);

      axios.post('get-authy-account', null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(({data}) => {
        this.tfa = data;
        localStorage.setItem('tfa', JSON.stringify(this.tfa));
      })
      .catch((err) => console.error(err))
      .finally(() => this.loading.pop());
    },

    generateAuthyQr() {
      this.loading.push(1);

      axios.post('generate-authy-qr', null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(({data: {qr_code}}) => this.qrCode = qr_code)
      .catch((err) => console.error(err))
      .finally(() => this.loading.pop());
    },

    sendAuthySMS() {
      this.loading.push(1);

      axios.post('send-authy-sms', null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(({data}) => console.log(data))
      .catch((err) => console.error(err))
      .finally(() => this.loading.pop());
    }
  }
}