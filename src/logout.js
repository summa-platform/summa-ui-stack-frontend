import {inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';
import AuthService from 'auth-service';
import log from 'logger';

@inject(AuthService, Router)
export class Logout {
	constructor(authService, router) {
		this.auth = authService;
		this.router = router;
	}

	async attached() {
		this.router.history.navigateBack();	// step back one level to remove the logout hash
		if(location.hash == '#/logout') {
			location.hash = '';	// if that didn't help (was not activated by logout button), remove the hash part
		}
		await this.auth.logout();
	}
}
