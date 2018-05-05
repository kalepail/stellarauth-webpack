import Vue from 'vue/dist/vue.esm';
import Vuex from 'vuex';
import { Auth0LockPasswordless } from 'auth0-lock';
import env from '../dev.json';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    lock: null,
    account: null,
    authIdTokenPayload: JSON.parse(localStorage.getItem('authIdTokenPayload')),
    authAccessToken: localStorage.getItem('authAccessToken'),
    authIdToken: localStorage.getItem('authIdToken'),
    pendingMethod: localStorage.getItem('pendingMethod'),

    loading: [],
    loader: null,
    interval: null,

    signing: null,
  },
  getters: {
    render(state) {
      if (state.account)
        return 'normal';

      else if (state.stellar)
        return 'fund'

      else
        return 'login'
    },
    stellar(state) {
      return state.authIdTokenPayload ? state.authIdTokenPayload[env.auth0.scope].stellar : null;
    },
    authy(state) {
      return state.authIdTokenPayload ? state.authIdTokenPayload[env.auth0.scope].authy : null;
    },
    disabled(state) {
      return !!state.loading.length;
    }
  },
  mutations: {
    setInterval(state, value) {
      state.interval = value;
    },
    setLoader(state, value) {
      state.loader = value;
    },
    setAuthIdTokenPayload(state, value) {
      state.authIdTokenPayload = value;
      localStorage.setItem('authIdTokenPayload', JSON.stringify(value));
    },
    toggleSigning(state) {
      state.signing = !state.signing;
    },
    setLock(state) {
      const settings = {
        autoclose: true,
        passwordlessMethod: 'code',
        auth: {
          redirectUrl: location.origin,
          responseType: 'token id_token'
        },
        theme: {
          primaryColor: '#0000FF',
          logo: env.auth0.logo
        },
        languageDictionary: {
          title: 'Stellar Auth Example'
        }
      }

      state.lock = new Auth0LockPasswordless(
        env.auth0.auth,
        env.auth0.domain,
        settings
      );
    },
    setAuthResult(state, value) {
      state.authIdToken = value.idToken;
      state.authAccessToken = value.accessToken;
      state.authIdTokenPayload = value.idTokenPayload;
      localStorage.setItem('authIdToken', value.idToken);
      localStorage.setItem('authAccessToken', value.accessToken);
      localStorage.setItem('authIdTokenPayload', JSON.stringify(value.idTokenPayload));
    },
    setAccount(state, value) {
      state.account = value;
    },
    setPendingMethod(state, value) {
      state.pendingMethod = value;

      if (value)
        localStorage.setItem('pendingMethod', value);
      else
        localStorage.removeItem('pendingMethod');
    }
  }
})