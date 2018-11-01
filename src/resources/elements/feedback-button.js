import {inject} from 'aurelia-framework';
import log from 'logger';
import {Services} from 'services';

@inject(Services)
export class FeedbackButton {
	constructor(services) {
		this.services = services;
	}
}
