import Authy from './authy-modal.html';
import { validate } from 'email-validator';
import appStore from '../../stores/app-store';
import authyModalStore from '../../stores/authy-modal-store';

export default {
  template: Authy,
  computed: {
    // State
      // authyModalStore
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
      axios: () => appStore.state.axios,
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
      authy: () => appStore.getters.authy,
  },
  watch: {
    defaultCountryCode() {
      const dial_code = this.country.dial_code.split(' ');

      if (this.phone) {
        this.phone.setRawValue(dial_code[1]);
        this.phone.setPhoneRegionCode(this.defaultCountryCode);
      }
    }
  },
  filters: {
    dialCode(dial_code) {
      return dial_code.split(' ')[0];
    }
  },
  mounted() {

  },
  methods: {
    focusPhone() {
      document.querySelector('.input-phone').focus();
    },

    submitCode(e) {
      e.preventDefault();
      appStore.dispatch('spendFunds');
    },

    setAuthyAccount(e) {
      e.preventDefault();

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

      this.axios.post('set-authy-account', {
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
          if (err)
            return console.error(err);

          appStore.commit('setAuthResult', authResult);
          authyModalStore.commit('updatePhone');
        });
      })
      .catch((err) => appStore.dispatch('handleWtError', {err, method: 'toggleSigning'}))
      .finally(() => this.loading.pop());
    },

    generateAuthyQr() {
      this.loading.push(1);

      this.axios.post('generate-authy-qr', null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(({data: {qr_code}}) => authyModalStore.commit('setQrCode', qr_code))
      .catch((err) => appStore.dispatch('handleWtError', {err, method: 'toggleSigning'}))
      .finally(() => this.loading.pop());
    },

    sendAuthySMS() {
      this.loading.push(1);

      this.axios.post('send-authy-sms', null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(({data}) => console.log(data))
      .catch((err) => appStore.dispatch('handleWtError', {err, method: 'toggleSigning'}))
      .finally(() => this.loading.pop());
    }
  }
}