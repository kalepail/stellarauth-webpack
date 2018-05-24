import Vue from 'vue/dist/vue.esm';
import Vuex from 'vuex';
import countryCodes from '../data/country-codes.json';
import _ from 'lodash';
import Cleave from 'cleave.js';
import 'cleave.js/dist/addons/cleave-phone.i18n.js';
import env from '../dev.json';
import appStore from './app-store';
import axios from 'axios';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    qrCode: null,

    phone: undefined,
    email: undefined,
    defaultCountryCode: 'US',

    code: null,

    signing: null,
  },
  getters: {
    countryCodes() {
      return _
      .chain(countryCodes)
      .filter((countryCode) => countryCode.dial_code)
      .uniqBy('code')
      .value();
    },
    country(state, getters) {
      const country = _.find(getters.countryCodes, {code: state.defaultCountryCode});
      return country ? country : _.find(getters.countryCodes, {code: 'US'});
    }
  },
  mutations: {
    setDefaultCountryCode(state, value) {
      state.defaultCountryCode = value;
    },
    setEmail(state, value) {
      state.email = value;
    },
    updatePhone(state) {
      if (appStore.getters.authy) {
        if (state.phone)
          return state.phone.destroy();
        return;
      }

      state.phone = new Cleave('.input-phone', {
        phone: true,
        phoneRegionCode: state.defaultCountryCode
      });
      state.phone.setRawValue();
    },
    setQrCode(state, value) {
      state.qrCode = value;
    },
    setCode(state, value) {
      state.code = value;
    }
  },
  actions: {
    toggleSigning({state, commit, dispatch}) {
      if (state.signing) { // Close the signing modal
        if (state.phone)
          state.phone.setRawValue();

        state.email = null;
        state.qrCode = null;
        state.code = null;

        state.signing = false;
      }

      else { // Open the signing modal
        commit('updatePhone');

        if (!appStore.getters.authy) {
          if (appStore.state.authIdTokenPayload.email)
            commit('setEmail', appStore.state.authIdTokenPayload.email);

          return dispatch('lookupPhoneNumber')
          .finally(() => state.signing = true);
        }

        else
          state.signing = true;
      }
    },

    lookupPhoneNumber({state, dispatch}) {
      if (
        !state.phone
        || !appStore.state.authIdTokenPayload[env.auth0.scope].phone
      ) return dispatch('getDefaultCountryCode');

      appStore.state.loading.push(1);

      return appStore.state.axios.post('utils/lookup', {
        number: appStore.state.authIdTokenPayload[env.auth0.scope].phone
      }, {
        headers: {authorization: `Bearer ${appStore.state.authIdToken}`}
      })
      .then(({data}) => {
        state.phone.setRawValue(data.national_format);
        state.phone.setPhoneRegionCode(data.country_code);
      })
      .catch((err) => console.error(err))
      .finally(() => appStore.state.loading.pop());
    },

    getDefaultCountryCode({commit}) {
      appStore.state.loading.push(1);

      return axios.get('https://api.ipdata.co')
      .then(({data}) => commit('setDefaultCountryCode', data.country_code))
      .catch((err) => console.error(err))
      .finally(() => appStore.state.loading.pop());
    }
  }
});
