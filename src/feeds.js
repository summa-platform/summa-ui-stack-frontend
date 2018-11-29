import {inject, bindable, observable, bindingMode} from 'aurelia-framework';
import log from 'logger';
import {Store} from 'store';
import {CompositionService} from 'composition-service';


@inject(Store, CompositionService)
export class Feeds {
	@observable filterText;
	@observable feedType;
	allFeedGroups = [];

	feedTypes = [];
	selectedFeed = undefined;
	selectedFeedGroup;
	feeds = [];

	constructor(store, compositionService) {
		this.store = store;
		this.compositionService = compositionService;
		this.store.getFeedGroups(true).then(feedGroups => this.allFeedGroups = feedGroups);
		this.store.getFeeds().then(feeds => { this.allFeeds = feeds; this.filterFeeds(); });
		this.store.getFeedTypes().then(feedTypes => {
			this.feedTypes = feedTypes;
			this.feedTypeTitle = this.feedTypes.reduce((acc, feed) => { acc[feed.internalval] = feed.label; return acc; }, {});
		});
	}

	filterFeeds() {
		let text = this.filterText && this.filterText.toLocaleLowerCase();
		let search = prop => (prop && prop.toLocaleLowerCase().indexOf(text) != -1); // search in in property
		if(this.selectedFeedGroup) {
			this.feeds = this.selectedFeedGroup.feeds;
		} else {
			this.feeds = this.allFeeds;
		}
		if(this.feedType) {
			this.feeds = this.feeds.filter(feed => {
				if((feed.type || feed.feedType) === this.feedType) {
					return true;
				}
				return false;
			});
		}
		if(text) {
			this.feeds = this.feeds.filter(feed => {
				if(search(feed.name))
					return true;
				return false;
			});
		}
	}

	feedTypeChanged() {
		this.filterFeeds();
	}

	filterTextChanged() {
		this.filterFeeds();
	}

	selectFeed(feed) {
		log.debug('Select feed:', feed);
		this.selectedFeed = feed;
	}

	// deprecated
	async newFeedOrFeedGroup() {
		let result = await this.newFeedOrFeedGroupModal();
		if(result) {
			if(result.type === 'feed') {
				let feed = await this.newFeedModal({});	// TODO: pass new/empty feed object
				if(feed) {
					log.debug('New Feed:', feed);
					this.store.addFeed(feed);
				} else {
					log.info('Add feed dialog cancelled');
				}
			} else if(result.type === 'feed-group') {
				let feedGroup = await this.newFeedGroupModal({});	// TODO: pass new/empty feed group object
				if(feedGroup) {
					log.debug('New Feed Group:', feedGroup);
					// feedGroup.feeds = feedGroup.feeds.map(feed => feed._id);
					this.store.addFeedGroup(feedGroup);
				} else {
					log.info('Add feed group dialog cancelled');
				}
			}
		}
	}

	async createFeedGroup() {
		let [dialog, destroy] = await this.compositionService.create('dialogs/feed-group-settings-dialog');
		let feedGroup = await dialog.viewModel.new({});
		destroy();

		try {
			if(feedGroup) {
				log.debug('New Feed Group:', feedGroup);
				// feedGroup.feeds = feedGroup.feeds.map(feed => feed._id);
				await this.store.addFeedGroup(feedGroup);
			} else {
				log.info('Add feed group dialog cancelled');
			}
		} catch(e) {
			console.error(e)
		}
	}

	async createNewFeed() {
		
		let [dialog, destroy] = await this.compositionService.create('dialogs/feed-settings-dialog');
		let feed = await dialog.viewModel.new({});
		destroy();

		if(feed) {
			log.debug('New Feed:', feed);
			try {
				await this.store.addFeed(feed);
			} catch(e) {
				console.error('error storing feed');
				console.error(e);
			}
		} else {
			log.info('Add feed dialog cancelled');
		}
	}

	async editFeedGroup(feedGroup, event) {
		log.debug('Edit feed group:', feedGroup);
		feedGroup = await this.store.getFeedGroup(feedGroup.id);
		let [dialog, destroy] = await this.compositionService.create('dialogs/feed-group-settings-dialog');
		dialog.viewModel.remove = (params) => { this.removeFeedGroup(params.$model); };
		feedGroup = await dialog.viewModel.edit(feedGroup);
		destroy();

		if(feedGroup) {
			log.debug('Edited feedGroup yet to be stored:', feedGroup);
			feedGroup = await this.store.saveFeedGroup(feedGroup);
			log.debug('Stored feedGroup:', feedGroup);
			feedGroup = await this.store.getFeedGroup(feedGroup.id);
			log.debug('Retrieved feedGroup:', feedGroup);
			this.selectedFeedGroup = Object.assign(this.selectedFeedGroup, feedGroup);	// apply to selected feed group
			this.filterFeeds();
		}
	}

	async removeFeedGroup(feedGroup) {
		let [dialog, destroy] = await this.compositionService.create('dialogs/confirmation-dialog');
		let result = await dialog.viewModel.open({
			title: `Delete Feed Group`,
			body: `Are you sure you want to delete feed group ${feedGroup.name} ?`,
			btnClass: 'danger',
			btnTitle: 'Delete Feed Group'
		});
		if(result) {
			try {
				log.debug('Delete feed group:', feedGroup);
				let result = await this.store.removeFeedGroup(feedGroup.id);
				this.selectedFeedGroup = undefined;	// select All Feeds
			} catch(e) {
				console.error(e);
			}
		}
	}

	async selectFeedGroup(feedGroup) {
		this.selectedFeedGroup = feedGroup;
		if(feedGroup) {
			this.selectedFeedGroup = Object.assign(feedGroup, await this.store.getFeedGroup(feedGroup.id));
		} else {
			this.allFeeds = await this.store.getFeeds();
		}
		this.selectedFeed = undefined;
		this.filterFeeds();
	}

	async editFeed(feed) {
		log.debug('Edit feed:', feed);
		let [dialog, destroy] = await this.compositionService.create('dialogs/feed-settings-dialog');
		dialog.viewModel.remove = (params) => { this.removeFeed(params.$model); };
		dialog.viewModel.model = feed;
		feed = await dialog.viewModel.edit(feed);
		destroy();

		if(feed) {
			log.debug('Edited feed yet to be stored:', feed);
			feed = await this.store.saveFeed(feed);
			log.debug('Stored feed:', feed);
		}
	}

	async removeFeed(feed) {
		let [dialog, destroy] = await this.compositionService.create('dialogs/confirmation-dialog');
		let result = await dialog.viewModel.open({
			title: `Delete Feed`,
			body: `Are you sure you want to delete feed ${feed.name} ?`,
			btnClass: 'danger',
			btnTitle: 'Delete Feed'
		});
		if(result) {
			try {
				log.debug('Delete feed:', feed);
				let result = await this.store.removeFeed(feed.id);
				this.selectedFeed = undefined;
			} catch(e) {
				console.error(e);
			}
		}
	}
}
