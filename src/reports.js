import {inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';
import log from 'logger';
import {Services} from 'services';
import {Store} from 'store';
import {CompositionService} from 'composition-service';
import moment from 'moment';

@inject(Router, Services, Store, CompositionService)
export class Feedback {
	allFeedback = [];
	selectedFeedback = undefined;
	enterResponse = false;

	constructor(router, services, store, compositionService) {
		this.router = router;
		this.services = services;
		this.store = store;
		this.compositionService = compositionService;
		this.statuses = this.store.getFeedbackStatuses().reduce((acc, item) => { acc[item.value] = item.label; return acc; }, {});
		this.store.getUsers();
		this.feedbackPromise = this.store.getFeedbackItems().then(feedback => this.allFeedback = feedback);
		this.store.getFeedbackRatingTypes().then(ratingTypes => {
			this.ratingTypes = ratingTypes.reduce((acc, ratingType) => { acc[ratingType.internalval] = ratingType.label; return acc; }, {});
		});
	}

	activate(params, routeConfig) {
		this.params = params;
	}

	attached() {
		// moved from activate() because route was not correctly set up, so navigate does not work correctly from activate
		if(this.params.reportID) {
			const reportID = this.params.reportID;
			this.feedbackPromise.then(reports => {
				const report = reports.find(report => report.id === reportID);
				if(report) {
					this.select(report);
				}
			});
		}
	}

	async select(feedback, skipNavigation) {
		if(!skipNavigation) {
			if(feedback)
				this.router.navigateToRoute('reports', { reportID: feedback.id }, { trigger: false });
			else
				this.router.navigateToRoute('reports', {}, { trigger: false });
		}
		if(feedback) {
			feedback = await this.store.getFeedbackItem(feedback.id, true);
			if(feedback.metadata.responses) {
				for(const response of feedback.metadata.responses) {
					if(response.time && !(response.time instanceof moment))
						response.time = moment(response.time);
				}
			}
		}
		this.selectedFeedback = feedback;
		this.editResponse = undefined;
	}

	async removeFeedback(feedback) {
		let [dialog, destroy] = await this.compositionService.create('dialogs/confirmation-dialog');
		// dialog.viewModel.remove = (params) => { this.removeUser(params.$model); };
		let result = await dialog.viewModel.open({
			title: `Delete Feedback Confirmation`,
			body: `Are you sure you want to delete the feedback reported ${feedback.timeAdded.fromNow()} by ${feedback.user.name} ?`,
			btnClass: 'danger',
			btnTitle: 'Delete Feedback'
		});
		if(result) {
			log.debug('Will remove feedback:', feedback);
			result = await this.store.removeFeedbackItem(feedback.id);
			log.debug('remove feedback result:', result);
			this.select();
		}
	}

	async editReport(feedback) {
		feedback = Object.assign({}, feedback);	// unlink
		feedback.metadata = Object.assign({}, feedback.metadata);	// unlink
		let [dialog, destroy] = await this.compositionService.create('dialogs/feedback-dialog');
		dialog.viewModel.remove = (params) => { this.removeFeedback(params.$model); };
		feedback = await dialog.viewModel.edit(feedback);
		destroy();
		if(feedback) {
			console.log('patch feedback:', feedback);
			feedback = await this.store.saveFeedbackItem(feedback);
			console.log('patched feedback:', feedback);
			if(typeof feedback.user === 'string') {
				feedback.user = this.store.users.find(user => user.id === feedback.user);
			}
			// this.select(feedback);
		}
	}

	getUser(id) {
		// if(!this.store.users || this.store.users.length === 0) {
		// 	await this.store.getUsers();
		// }
		return this.store.users.find(user => user.id === id).name;
	}

	async newResponse() {
		this.editResponse = null;
		this.responseText = '';
	}

	async cancelResponse() {
		this.editResponse = undefined;
		this.responseText = '';
	}

	async doEditResponse(response) {
		this.editResponse = response;
		this.responseText = response.text;
	}

	async removeResponse(response) {
		let [dialog, destroy] = await this.compositionService.create('dialogs/confirmation-dialog');
		// dialog.viewModel.remove = (params) => { this.removeUser(params.$model); };
		let result = await dialog.viewModel.open({
			title: `Delete Feedback Response Confirmation`,
			body: `Are you sure you want to delete response created/edited ${response.time.fromNow()} by ${this.getUser(response.user)} ?`,
			btnClass: 'danger',
			btnTitle: 'Delete Response'
		});
		if(result)
			this.saveResponse(response, true);
	}

	async saveResponse(response, remove) {
		this.editResponse = undefined;

		// get latest feedback data
		let feedback = await this.store.getFeedbackItem(this.selectedFeedback.id);
		if(response && response.id && feedback.metadata.responses) {
			const id = response.id;
			const i = feedback.metadata.responses.findIndex(response => response.id === id);
			if(i !== -1) {
				if(remove) {
					feedback.metadata.responses.splice(i, 1);
				} else {
					response = feedback.metadata.responses[i];
					response.edited = true;
					response.text = this.responseText;
					response.time = moment(new Date());
				}
			}
		} else {
			// new response
			response = { id: this.guid(), time: moment(new Date()), text: this.responseText, user: this.store.currentUser.id };
			if(!feedback.metadata.responses)
				feedback.metadata.responses = [];
			feedback.metadata.responses.push(response);
		}
		feedback = await this.store.saveFeedbackItem(feedback);
		if(feedback.metadata.responses) {
			for(const response of feedback.metadata.responses) {
				if(response.time && !(response.time instanceof moment))
					response.time = moment(response.time);
			}
		}
		if(typeof feedback.user === 'string') {
			feedback.user = this.store.users.find(user => user.id === feedback.user);
		}
		// this.selectedFeedback = feedback;	// if saveFeedbackItem did not merge
	}

	guid() {
		// RFC4122 version 4 compliant solution from
		// https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
		// TODO: use https://github.com/kelektiv/node-uuid
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	}
}
