import { inject, Aurelia } from 'aurelia-framework';
import AuthService from 'auth-service';
import log from 'logger';
import {Store} from 'store';

@inject(Aurelia, AuthService, Store)
export class Login {
	email = '';
	password = '';
	error = '';

	constructor(aurelia, authService, store) {
		this.auth = authService;
		this.store = store;

		this.auth.isAuthenticated().then(auth => { if(auth) aurelia.setRoot('app'); });
	}

	async login() {
		if(this.email && this.password) {
			if(!await this.auth.login(this.email, this.password)) {
				this.error = this.auth.error || 'Invalid login. Please try again.';
				// this.error = 'Invalid login. Please try again.';
			} else {
				this.error = '';
			}
		} else {
			this.error = 'Please enter a username and password.';
		}
	}

	async attached() {
		this.store.currentView = 'login';
	}
}
