import Vue from 'vue/dist/vue.esm';
import App from '../layouts/app.html';
import $Home from '../pages/home/home';

export default new Vue({
  el: 'app',
  template: App,
  data: {

  },
  components: {
    'see-home': $Home,
  },
  mounted() {

  },
  computed: {

  },
  methods: {

  }
});
