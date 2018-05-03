import Home from './home.html';
import { Auth0LockPasswordless } from 'auth0-lock';
import axios from 'axios';
import StellarSdk from 'stellar-sdk';
import { getRandomBraille } from '../../js/braille';
import env from '../../dev.json';

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

export default {
  template: Home,
  data() {
    return {
      lock: null,
      account: null,
      authIdTokenPayload: JSON.parse(localStorage.getItem('authIdTokenPayload')),
      authAccessToken: localStorage.getItem('authAccessToken'),
      authIdToken: localStorage.getItem('authIdToken'),
      signIdToken: localStorage.getItem('signIdToken'),
      pendingMethod: localStorage.getItem('pendingMethod'),

      loading: [],
      loader: null,
      interval: null
    }
  },
  computed: {
    render() {
      if (this.account)
        return 'normal';

      else if (this.stellar)
        return 'fund'

      else
        return 'login'
    },
    stellar() {
      return this.authIdTokenPayload ? this.authIdTokenPayload[env.auth0.scope].stellar : null;
    }
  },
  watch: {
    loading() {
      if (this.loading.length)
        this.interval = this.interval || setInterval(() => this.loader = getRandomBraille(2), 100);
      else {
        clearInterval(this.interval);
        this.interval = null;
      }
    }
  },
  mounted() {
    this.lock = new Auth0LockPasswordless(
      env.auth0.init,
      env.auth0.domain
    );

    if (this.authAccessToken)
      this.lock.getUserInfo(this.authAccessToken, (err, idTokenPayload) => {
        if (err) {
          console.error(err);

          switch(err.status) {
            case 429:
            return this.logOut();

            default:
            return;
          }
        }

        this.authIdTokenPayload = idTokenPayload;
        localStorage.setItem('authIdTokenPayload', JSON.stringify(this.authIdTokenPayload));

        this.checkAccountBalance();
      });

    this.lock.on('authenticated', this.lockAuthenticated);
  },
  methods: {
    logOut() {
      localStorage.removeItem('authAccessToken');
      localStorage.removeItem('authIdTokenPayload');
      localStorage.removeItem('authIdToken');
      localStorage.removeItem('signIdToken');
      localStorage.removeItem('pendingMethod');
      this.lock.logout({returnTo: location.origin});
    },

    openAuth(state = 'auth') {
      const settings = {
        autoclose: true,
        passwordlessMethod: 'code',
        auth: {
          redirectUrl: location.origin,
          responseType: 'token id_token',
          params: {state}
        },
        theme: {
          primaryColor: '#0000FF',
          logo: 'https://d3vv6lp55qjaqc.cloudfront.net/items/191f0b3H3R1e0P421G42/stellar-rocket@2x.png'
        },
        languageDictionary: {
          title: 'Stellar Auth Example'
        },
      }

      if (state === 'sign')
        this.lock = new Auth0LockPasswordless(
          env.auth0.sign,
          env.auth0.domain,
          settings
        );

      else
        this.lock = new Auth0LockPasswordless(
          env.auth0.auth,
          env.auth0.domain,
          settings
        );

      this.lock.on('authenticated', this.lockAuthenticated);
      this.lock.show();
    },

    lockAuthenticated(authResult) {
      if (authResult.state === 'sign') {
        if (!this.authIdTokenPayload.sub) // Not signed in
          return this.logOut();

        if (this.authIdTokenPayload.sub !== authResult.idTokenPayload.sub) // Accounts mismatched
          return alert(`Authentication accounts mismatched\nAuth: ${this.authIdTokenPayload.sub}\nSign: ${authResult.idTokenPayload.sub}`);

        this.signIdToken = authResult.idToken;
        localStorage.setItem('signIdToken', authResult.idToken);

        this.spendFunds();
      }

      else {
        if ( // Accounts mismatched
          this.authIdTokenPayload &&
          this.authIdTokenPayload.sub !== authResult.idTokenPayload.sub
        ) return alert(`Authentication accounts mismatched\n${this.authIdTokenPayload.sub} vs. ${authResult.idTokenPayload.sub}`);

        this.authIdToken = authResult.idToken;
        this.authAccessToken = authResult.accessToken;
        this.authIdTokenPayload = authResult.idTokenPayload;
        localStorage.setItem('authIdToken', this.authIdToken);
        localStorage.setItem('authAccessToken', this.authAccessToken);
        localStorage.setItem('authIdTokenPayload', JSON.stringify(this.authIdTokenPayload));

        if (this.pendingMethod)
          this[this.pendingMethod]();

        else if (!this.stellar)
          this.setAccount();

        else
          this.checkAccountBalance();
      }
    },

    checkAccountBalance() {
      if (this.stellar) {
        this.loading.push(1);

        server.loadAccount(this.stellar.publicKey)
        .then((account) => this.account = account)
        .catch((err) => console.error(err))
        .finally(() => {
          localStorage.removeItem('pendingMethod');
          this.loading.splice(0, 1);
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
      .finally(() => this.loading.splice(0, 1));
    },

    createAccount() {
      this.loading.push(1);

      axios.post('create-stellar-account/test', null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(() => this.checkAccountBalance())
      .catch((err) => this.handleWtError(err, 'createAccount'))
      .finally(() => this.loading.splice(0, 1));
    },

    fundAccount() {
      this.loading.push(1);

      axios.post('fund-stellar-account/test', null, {
        headers: {authorization: `Bearer ${this.authIdToken}`}
      })
      .then(() => this.checkAccountBalance())
      .catch((err) => this.handleWtError(err, 'fundAccount'))
      .finally(() => this.loading.splice(0, 1));
    },

    handleWtError(err, method) {
      console.error(err);

      if (err.response.status === 401) {
        this.pendingMethod = method;
        localStorage.setItem('pendingMethod', method);
        this.openAuth();
      }
    },

    spendFunds() {
      if (!this.stellar)
        return;

      this.loading.push(1);

      const publicKey = this.stellar.publicKey;
      const destinationId = env.stellar.address;

      server.loadAccount(destinationId)
      .then(() => server.loadAccount(publicKey))
      .then((sourceAccount) => {
        return new StellarSdk.TransactionBuilder(sourceAccount)
        .addOperation(StellarSdk.Operation.payment({
          destination: destinationId,
          asset: StellarSdk.Asset.native(),
          amount: '1'
        }))
        .build();
      })
      .then((transaction) => {
        const xdr = transaction.toEnvelope().toXDR().toString('base64');
        return axios.post('sign-stellar-transaction/test', {xdr}, {
          headers: {authorization: `Bearer ${this.signIdToken}`}
        });
      })
      .then(() => this.checkAccountBalance())
      .catch((err) => {
        console.error(err);

        if (err.response.status === 401)
          this.openAuth('sign');
      })
      .finally(() => this.loading.splice(0, 1));
    }
  }
}