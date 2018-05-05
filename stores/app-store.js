import Vue from 'vue/dist/vue.esm';
import Vuex from 'vuex';
import { Auth0LockPasswordless } from 'auth0-lock';
import env from '../dev.json';
import authyModalStore from './authy-modal-store';
import axios from 'axios';
import StellarSdk from 'stellar-sdk';

Vue.use(Vuex);

let server;

if (env.stellar.net === 'public') {
  StellarSdk.Network.usePublicNetwork();
  server = new StellarSdk.Server('https://horizon.stellar.org');
}

else {
  StellarSdk.Network.useTestNetwork();
  server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
}

export default new Vuex.Store({
  state: {
    axios: axios.create({
      baseURL: env.wt,
      headers: {'Content-Type': 'application/json'}
    }),
    lock: null,
    account: null,
    authIdTokenPayload: JSON.parse(localStorage.getItem('authIdTokenPayload')),
    authAccessToken: localStorage.getItem('authAccessToken'),
    authIdToken: localStorage.getItem('authIdToken'),
    pendingMethod: localStorage.getItem('pendingMethod'),

    loading: [],
    loader: null,
    interval: null,
  },
  getters: {
    render(state, getters) {
      if (state.account)
        return 'normal';

      else if (getters.stellar)
        return 'fund';

      else
        return 'login';
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
  },
  actions: {
    handleWtError({commit, dispatch}, {err, method}) {
      console.error(err);

      if (err.response.status === 401) {
        commit('setPendingMethod', method);
        dispatch('setLock');
      }
    },

    setLock({state, dispatch}, open = true) {
      const settings = {
        autoclose: true,
        passwordlessMethod: 'code',
        // allowedConnections: ['sms'],
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

      state.lock.on('authenticated', (authResult) => dispatch('lockAuthenticated', authResult));

      if (open)
        state.lock.show();
    },

    lockAuthenticated({state, dispatch, getters, commit}, authResult) {
      if ( // Accounts mismatched
        state.authIdTokenPayload &&
        state.authIdTokenPayload.sub !== authResult.idTokenPayload.sub
      ) return alert(`Authentication accounts mismatched\nCurrent: ${state.authIdTokenPayload.sub}\nNew: ${authResult.idTokenPayload.sub}`);

      commit('setAuthResult', authResult);

      if (state.pendingMethod)
        dispatch(state.pendingMethod);

      else if (!getters.stellar)
        dispatch('setAccount');

      else
        dispatch('checkAccountBalance');
    },

    checkAccountBalance({state, commit, getters}) {
      if (getters.stellar) {
        state.loading.push(1);

        server.loadAccount(getters.stellar.publicKey)
        .then((account) => commit('setAccount', account))
        .catch((err) => console.error(err))
        .finally(() => {
          state.loading.pop();
          commit('setPendingMethod', null);
        });
      }
    },

    setAccount({state, commit, dispatch}) {
      state.loading.push(1);

      state.axios.post('set-stellar-account', null, {
        headers: {authorization: `Bearer ${state.authIdToken}`}
      })
      .then(() => { // Stellar account should be available now, go get and set it
        state.lock.checkSession({scope: 'openid profile email'}, (err, authResult) => {
          if (err)
            return console.error(err);

          commit('setAuthResult', authResult);
        });
      })
      .catch((err) => dispatch('handleWtError', {err, method: 'setAccount'}))
      .finally(() => state.loading.pop());
    },

    createAccount({state, dispatch}) {
      state.loading.push(1);

      state.axios.post(`create-stellar-account/${env.stellar.net}`, null, {
        headers: {authorization: `Bearer ${state.authIdToken}`}
      })
      .then(() => dispatch('checkAccountBalance'))
      .catch((err) => dispatch('handleWtError', {err, method: 'createAccount'}))
      .finally(() => state.loading.pop());
    },

    fundAccount({state, dispatch}) {
      state.loading.push(1);

      state.axios.post(`fund-stellar-account/${env.stellar.net}`, null, {
        headers: {authorization: `Bearer ${state.authIdToken}`}
      })
      .then(() => dispatch('checkAccountBalance'))
      .catch((err) => dispatch('handleWtError', {err, method: 'fundAccount'}))
      .finally(() => state.loading.pop());
    },

    spendFunds({state, dispatch, getters}, code) {
      if (!getters.stellar)
        return;

      if (!code)
        return authyModalStore.dispatch('toggleSigning');

      state.loading.push(1);

      server.loadAccount(env.stellar.master_fee)
      .then((sourceAccount) => {
        return new StellarSdk.TransactionBuilder(sourceAccount)
        .addOperation(StellarSdk.Operation.payment({
          destination: env.stellar.master_fund,
          asset: StellarSdk.Asset.native(),
          amount: '1',
          source: getters.stellar.publicKey
        }))
        .build();
      })
      .then((transaction) => {
        const xdr = transaction.toEnvelope().toXDR().toString('base64');

        return state.axios.post(`sign-stellar-transaction/${env.stellar.net}`, {xdr, code}, {
          headers: {authorization: `Bearer ${state.authIdToken}`}
        });
      })
      .then(() => {
        authyModalStore.dispatch('toggleSigning');
        return dispatch('checkAccountBalance');
      })
      .catch((err) => dispatch('handleWtError', {err, method: 'spendFunds'}))
      .finally(() => state.loading.pop());
    }
  }
})