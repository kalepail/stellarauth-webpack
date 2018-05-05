import Authy from './authy-modal.html';
import axios from 'axios';
import { validate } from 'email-validator';
import env from '../../dev.json';
import appStore from '../../stores/app-store';
import authyModalStore from '../../stores/authy-modal-store';

axios.defaults.baseURL = env.wt;
axios.defaults.headers.common['Content-Type'] = 'application/json';

export default {
  template: Authy,
  computed: {
    // State
      // authyModalStore
      tfa: () => authyModalStore.state.tfa,
      qrCode: () => authyModalStore.state.qrCode,
      phone: () => authyModalStore.state.phone,
      email: {
        get: () => authyModalStore.state.email,
        set: (value) => authyModalStore.commit('setEmail', value)
      },
      defaultCountryCode: {
        get: () => authyModalStore.state.defaultCountryCode,
        set: (value) => authyModalStore.commit('setDefaultCountryCode', value)
      },
      code: {
        get: () => authyModalStore.state.code,
        set: (value) => authyModalStore.commit('setCode', value)
      },

      // appStore
      lock: () => appStore.state.lock,
      authIdToken: () => appStore.state.authIdToken,
      authIdTokenPayload: () => appStore.state.authIdTokenPayload,
      loading: () => appStore.state.loading,
      loader: () => appStore.state.loader,
      signing: () => appStore.state.signing,

    // Getters
      // authyModalStore
      countryCodes: () => authyModalStore.getters.countryCodes,
      country: () => authyModalStore.getters.country,

      // appStore
      disabled: () => appStore.getters.disabled,
  },
  watch: {
    defaultCountryCode() {
      const dial_code = this.country.dial_code.split(' ');

      if (this.phone) {
        this.phone.setRawValue(dial_code[1]);
        this.phone.setPhoneRegionCode(this.defaultCountryCode);
      }
    },
    tfa() { // When tfa is changed check the cleave instance
      authyModalStore.commit('setCleave');
    },
    signing() {
      if (this.signing)
        this.getAuthyAccount();
    }
  },
  filters: {
    dialCode(dial_code) {
      return dial_code.split(' ')[0];
    }
  },
  mounted() {
    authyModalStore.dispatch('getDefaultCountryCode')
    .finally(() =>authyModalStore.commit('setCleave'));
  },
  methods: {
    focusPhone() {
      document.querySelector('.input-phone').focus();
    },

    submitCode(e) {
      e.preventDefault();
      this.$emit('spendFunds', this.code);
    },

    getAuthyAccount() {
      this.loading.push(1);

      axios.post('get-authy-account', null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(({data}) => {
        authyModalStore.commit('setTfa', data);
        localStorage.setItem('tfa', JSON.stringify(this.tfa));
      })
      .catch((err) => this.$emit('handleWtError', err))
      .finally(() => this.loading.pop());
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
        !validate(this.email)
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
      .catch((err) => this.$emit('handleWtError', err))
      .finally(() => this.loading.pop());
    },

    generateAuthyQr() {
      this.loading.push(1);

      axios.post('generate-authy-qr', null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(({data: {qr_code}}) => authyModalStore.commit('setQrCode', qr_code))
      .catch((err) => this.$emit('handleWtError', err))
      .finally(() => this.loading.pop());
    },

    sendAuthySMS() {
      this.loading.push(1);

      axios.post('send-authy-sms', null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(({data}) => console.log(data))
      .catch((err) => this.$emit('handleWtError', err))
      .finally(() => this.loading.pop());
    }
  }
}