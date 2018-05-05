import Vue from 'vue/dist/vue.esm';
import App from './app.html';
import axios from 'axios';
import StellarSdk from 'stellar-sdk';
import { getRandomBraille } from '../js/braille';
import env from '../dev.json';
import appStore from '../stores/app-store';
import authyModalStore from '../stores/authy-modal-store';

import $AuthyModal from '../pages/authy-modal/authy-modal';

let server;

if (env.stellar.net === 'public') {
  StellarSdk.Network.usePublicNetwork();
  server = new StellarSdk.Server('https://horizon.stellar.org');
}

else {
  StellarSdk.Network.useTestNetwork();
  server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
}

axios.defaults.baseURL = env.wt;
axios.defaults.headers.common['Content-Type'] = 'application/json';

export default new Vue({
  el: 'app',
  template: App,
  components: {
    'authy-modal': $AuthyModal
  },
  computed: {
    lock: () => appStore.state.lock,
    account: () => appStore.state.account,
    authIdTokenPayload: () => appStore.state.authIdTokenPayload,
    authAccessToken: () => appStore.state.authAccessToken,
    authIdToken: () => appStore.state.authIdToken,
    pendingMethod: () => appStore.state.pendingMethod,
    loading: () => appStore.state.loading,
    loader: () => appStore.state.loader,
    interval: () => appStore.state.interval,
    signing: () => appStore.state.signing,

    render: () => appStore.getters.render,
    stellar: () => appStore.getters.stellar,
    authy: () => appStore.getters.authy,
    disabled: () => appStore.getters.disabled,
  },
  watch: {
    loading() {
      if (this.disabled) {
        appStore.commit('setInterval', this.interval || setInterval(() => appStore.commit('setLoader', getRandomBraille(2)), 20));
      }
      else {
        clearInterval(this.interval);
        appStore.commit('setInterval', null);
      }
    }
  },
  mounted() {
    // this.toggleAuthy();
    // this.loading.push(1);

    this.setAuth(false);

    if (this.authAccessToken)
      this.lock.getUserInfo(this.authAccessToken, (err, idTokenPayload) => {
        if (err) {
          switch(err.status) {
            case 429:
            return this.logOut();

            default:
            return console.error(err);
          }
        }

        appStore.commit('setAuthIdTokenPayload', idTokenPayload);

        this.checkAccountBalance();
      });
  },
  methods: {
    toggleAuthy() {
      authyModalStore.commit('resetModal');
      appStore.commit('toggleSigning');
    },

    logOut() {
      localStorage.removeItem('authAccessToken');
      localStorage.removeItem('authIdTokenPayload');
      localStorage.removeItem('authIdToken');
      localStorage.removeItem('pendingMethod');
      localStorage.removeItem('tfa');
      this.lock.logout({returnTo: location.origin});
    },

    setAuth(open = true) {
      appStore.commit('setLock');

      this.lock.on('authenticated', this.lockAuthenticated);

      if (open)
        this.lock.show();
    },

    lockAuthenticated(authResult) {
      if ( // Accounts mismatched
        this.authIdTokenPayload &&
        this.authIdTokenPayload.sub !== authResult.idTokenPayload.sub
      ) return alert(`Authentication accounts mismatched\nCurrent: ${this.authIdTokenPayload.sub}\nNew: ${authResult.idTokenPayload.sub}`);

      appStore.commit('setAuthResult', authResult);

      if (this.pendingMethod)
        this[this.pendingMethod]();

      else if (!this.stellar)
        this.setAccount();

      else
        this.checkAccountBalance();
    },

    checkAccountBalance() {
      if (this.stellar) {
        this.loading.push(1);

        server.loadAccount(this.stellar.publicKey)
        .then((account) => appStore.commit('setAccount', account))
        .catch((err) => console.error(err))
        .finally(() => {
          this.loading.pop();
          appStore.commit('setPendingMethod', null);
        });
      }

      return true;
    },

    setAccount() {
      this.loading.push(1);

      axios.post('set-stellar-account', null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(() => { // Stellar account should be available now, go get and set it
        this.lock.checkSession({scope: 'openid profile email'}, (err, authResult) => {
          if (err) {
            console.error(err);
            return;
          }

          this.lockAuthenticated(authResult);
        });
      })
      .catch((err) => this.handleWtError(err, 'setAccount'))
      .finally(() => this.loading.pop());
    },

    createAccount() {
      this.loading.push(1);

      axios.post(`create-stellar-account/${env.stellar.net}`, null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(() => this.checkAccountBalance())
      .catch((err) => this.handleWtError(err, 'createAccount'))
      .finally(() => this.loading.pop());
    },

    fundAccount() {
      this.loading.push(1);

      axios.post(`fund-stellar-account/${env.stellar.net}`, null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(() => this.checkAccountBalance())
      .catch((err) => this.handleWtError(err, 'fundAccount'))
      .finally(() => this.loading.pop());
    },

    handleWtError(err, method) {
      console.error(err);

      if (err.response.status === 401) {
        appStore.commit('setPendingMethod', method);
        this.setAuth();
      }
    },

    spendFunds(code) {
      if (!this.stellar)
        return;

      if (!code)
        return this.toggleAuthy();

      this.loading.push(1);

      server.loadAccount(env.stellar.master_fee)
      .then((sourceAccount) => {
        return new StellarSdk.TransactionBuilder(sourceAccount)
        .addOperation(StellarSdk.Operation.payment({
          destination: env.stellar.master_fund,
          asset: StellarSdk.Asset.native(),
          amount: '1',
          source: this.stellar.publicKey
        }))
        .build();
      })
      .then((transaction) => {
        const xdr = transaction.toEnvelope().toXDR().toString('base64');

        return axios.post(`sign-stellar-transaction/${env.stellar.net}`, {xdr, code}, {
          headers: {authorization: `Bearer ${this.authIdToken}`}
        });
      })
      .then(() => {
        this.toggleAuthy();
        return this.checkAccountBalance();
      })
      .catch((err) => this.handleWtError(err, 'spendFunds'))
      .finally(() => this.loading.pop());
    }
  }
});