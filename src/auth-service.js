import {inject, Aurelia} from 'aurelia-framework';
import {HttpClient} from 'aurelia-fetch-client';
import config from 'config';
import log from 'logger';
import {Store} from 'store';


@inject(Aurelia, HttpClient, Store)
export default class AuthService {
	constructor(aurelia, httpClient, store) {
		this.app = aurelia;
		this.store = store;
		this.session = null;
		let session = localStorage['session'] || null;
		this.userPromise = this.getUser();
		// this.http = httpClient.configure(c => {
		// 	c.withBaseUrl(config.baseUrl);
		// });
		// this.session = JSON.parse(localStorage[config.tokenName] || null);
		// this.session = localStorage['session'] || null;
	}

	async getUser() {
		await this.store.getToken();
		try {
			let session = 'current';
			let user = await this.store.getUser(session);
			this.store.currentUser = user;
			log.debug('current user:', this.store.currentUser);
			this.session = user.id;
		} catch(e) {
			this.session = null;
		}
	}
	
	async login(email, password) {
		log.debug('login');
		this.error = '';
		try {
			let login = await this.store.checkPassword(email, password);
			this.store.currentUser = login;
			this.session = this.store.currentUser.id;
			localStorage['session'] = login.id;
			this.app.setRoot('app');
			return true;
		} catch(e) {
			this.session = null;
			localStorage['session'] = '';
			if(e.response && e.response.status == 404) {
				let text = e.body && e.body.message || 'User not found.';
				this.error = text;
			} else if(e.response && e.response.status == 401) {
				this.error = e.body && e.body.message || 'Invalid login.';
			} else  {
				this.error = e.toString();
			}
			log.error(this.error);
			return;
		}
		// TODO: retrieve token from backend
		// this.http.post(config.loginUrl, { username, password })
		// 	.then((response) => response.content)
		// 	.then((session) => {
		// 		localStorage[config.tokenName] = JSON.stringify(session);
		// 		this.session = session;
		// 		this.app.setRoot('app');
		// 	});
	}

	async logout() {
		log.debug('logout');
		// localStorage[config.tokenName] = null;
		localStorage['token'] = undefined;
		localStorage['session'] = '';
		this.session = null;
		await this.store.logout();	// remove auth cookie and in-memory auth token
		this.app.setRoot('login');	// redirect to login page
	}

	async isAuthenticated() {
		await this.userPromise;
		// if(this.session && (!this.store.currentUser || this.store.currentUser.id != this.session)) {
		// 	// this.store.currentUserPromise = this.store.getUser(this.session).then(user => this.store.currentUser = user);
		// 	await this.userPromise;
		// 	// try {
		// 	// 	this.store.currentUser = await this.store.getUser(this.session);
		// 	// 	this.session = this.store.currentUser.id;
		// 	// } catch(e) {
		// 	// 	this.session = null;
		// 	// }
		// }
		return !!this.session;
	}
}
