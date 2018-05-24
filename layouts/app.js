import Vue from 'vue/dist/vue.esm';
import App from './app.html';
import { getRandomBraille } from '../js/braille';
import appStore from '../stores/app-store';
import authyModalStore from '../stores/authy-modal-store';

import $AuthyModal from '../pages/authy-modal/authy-modal';

export default new Vue({
  el: 'app',
  template: App,
  components: {
    'authy-modal': $AuthyModal
  },
  computed: {
    // State
      // appStore
      lock: () => appStore.state.lock,
      account: () => appStore.state.account,
      authAccessToken: () => appStore.state.authAccessToken,
      stellarChildKey: () => appStore.state.stellarChildKey,
      loading: () => appStore.state.loading,
      loader: () => appStore.state.loader,
      interval: () => appStore.state.interval,

      // authyModalStore
      signing: () => authyModalStore.state.signing,

    // Getters
      // appStore
      render: () => appStore.getters.render,
      disabled: () => appStore.getters.disabled,

      // authyModalStore
  },
  watch: {
    loading() {
      if (this.disabled) {
        appStore.commit('setInterval', this.interval || setInterval(() => appStore.commit('setLoader', getRandomBraille(2)), 50));
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
    appStore.dispatch('setLock', false);

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

        appStore.dispatch('checkAccountBalance');
      });
  },
  methods: {
    setLock() {
      appStore.dispatch('setLock');
    },

    createAccount() {
      appStore.dispatch('createAccount');
    },

    fundAccount() {
      appStore.dispatch('fundAccount');
    },

    toggleAuthy() {
      authyModalStore.dispatch('toggleSigning');
    },

    logOut() {
      sessionStorage.removeItem('authAccessToken');
      sessionStorage.removeItem('authIdTokenPayload');
      sessionStorage.removeItem('authIdToken');
      sessionStorage.removeItem('pendingMethod');
      sessionStorage.removeItem('stellarChildKey');
      this.lock.logout({returnTo: location.origin});
    }
  }
});
