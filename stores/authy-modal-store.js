import Vue from 'vue/dist/vue.esm';
import Vuex from 'vuex';
import countryCodes from '../data/country-codes.json';
import axios from 'axios';
import _ from 'lodash';
import Cleave from 'cleave.js';
import 'cleave.js/dist/addons/cleave-phone.i18n.js';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    tfa: JSON.parse(localStorage.getItem('tfa')),
    qrCode: null,

    phone: undefined,
    email: undefined,
    defaultCountryCode: 'US',

    code: null,
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
    setCleave(state) {
      if (state.tfa) {
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
    setTfa(state, value) {
      state.tfa = value;
    },
    setQrCode(state, value) {
      state.qrCode = value;
    },
    setCode(state, value) {
      state.code = value;
    },
    resetModal(state) {
      if (state.phone)
        state.phone.setRawValue();

      state.email = null;
      state.qrCode = null;
      state.code = null;
    }
  },
  actions: {
    getDefaultCountryCode({commit}) {
      return axios.get('https://api.ipdata.co')
      .then(({data}) => commit('setDefaultCountryCode', data.country_code))
      .catch((err) => console.error(err));
    }
  }
})