import {inject, bindable, observable, computedFrom} from 'aurelia-framework';
import {Router, Redirect} from 'aurelia-router';
import log from 'logger';
import {Store} from 'store';
import {Services} from 'services';
import moment from 'moment';
import {CompositionService} from 'composition-service';
import jQuery from 'jquery';


@inject(Store, Router, Services, CompositionService)
export class MediaItem {

	@bindable neighbourMediaItems = [];
	@bindable selectedMediaItem;
	@bindable currentMediaItem;
	@bindable rowElement;
	@bindable neighboursTable;
	@bindable videoSection;
	@bindable neighboursSection;

	constructor(store, router, services, compositionService) {
		this.store = store;
		this.router = router;
		this.services = services;
		this.compositionService = compositionService;
		this.janis = undefined;
		this.janis2 = true;
	}

	@computedFrom('mediaItem')
	get mediaItemTitle() {
		if(!this.mediaItem) {
			return '';
		}
		return typeof this.mediaItem.title === 'object' ? this.mediaItem.title.english || this.mediaItem.title.original : this.mediaItem.title;
	}

	async activate(params, routeConfig, navigationInstruction) {
		this.params = params;
		this.routeConfig = routeConfig;
		// this.navigationInstruction = navigationInstruction;

		// fast
		/*
		if(this.services.query && this.services.query.id === this.params.queryID) {
			this.query = this.services.query;
		} else {
			this.query = undefined;
		}
		if(this.services.story && this.services.story.id === this.params.storyID) {
			this.story = this.services.story;
		} else {
			this.story = undefined;
		}
		if(this.services.mediaItem && this.services.mediaItem.id === this.params.mediaItemID) {
			this.mediaItem = this.services.mediaItem;
		} else {
			this.mediaItem = undefined;
		}
		if(this.services.feed && this.services.feed.id === this.params.feedID) {
			this.feed = this.services.feed;
		} else {
			this.feed = undefined;
		}


		if(this.params.queryID && this.params.queryID !== 'all') {
			// only needed to set query name in path bar
			// this.store.getQueryStories(this.params.queryID).then(query => { this.query = query; this.services.query = query; });
			this.store.getQuery(this.params.queryID).then(query => { this.query = query; this.services.query = query; this.setTitle(); });

			// only needed to set story name in path bar
			// this.store.getStory(this.params.storyID).then(story => { this.story = story; this.services.story = story; });
			if(this.params.storyID) {
				this.store.getQueryStory(this.params.queryID, this.params.storyID).then(story => { this.story = story; this.services.story = story; });
			} else {
				this.services.story = this.story = undefined;
			}
		}
		if(this.params.feedID) {
			this.store.getFeed(this.params.feedID).then(feed => { this.feed = feed; this.services.feed = feed; this.setTitle(); });
		}
		if(this.params.pastHour) {
			this.pastHour = this.params.pastHour.split('-', 2)[1];
		}
		*/

		this.store.getMediaItem(this.params.mediaItemID).then(mediaItem => { this.selectedMediaItem = this.currentMediaItem = this.mediaItem = mediaItem;
			this.services.mediaItem = mediaItem; });
		this.store.getMediaItemNeighbours(this.params.mediaItemID).then(mediaItems => {
			for(let mediaItem of mediaItems) {
				mediaItem.topics = mediaItem.topics.join(', ');
				// mediaItem.topics = mediaItem.topics.slice(0, 3).join(', ');
			}
			this.neighbourMediaItems = mediaItems;
			setTimeout(() => this.scrollToCurrent(), 500);
		});
	}

	setTitle() {
		if(this.params.entity && this.params.pastHour) {
			let queryName = this.query ? this.query.name : 'All';
			// this.title = `Media Items of Query: ${queryName} and Entity: ${this.params.entity} for past hour: -${this.pastHour}`;
			this.title = `Media Items with Entity "${this.params.entity}" of Query "${queryName}" from ${this.pastHour}h ago`;
		} else if(this.feed && this.params.pastHour) {
			this.title = `Media Items from Feed "${this.feed.name}" from ${this.pastHour}h ago`;
		} else {
			this.title = undefined;
		}
	}

	attached() {
		this.setTitle();
	}

	async newQuery() {
		let query = await this.services.newQuery();
		if(query) {
			this.router.navigateToRoute('query-trending-id', { queryID: query.id }, { trigger: true });	// to query trending view
		}
	}

	async openMediaItem(id, event) {
		const route = 'media-item';
		const params = { mediaItemID: id };

		if(this.services.altTouch || event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) {
			// use any modifier as an excuse to open in separate tab/window
			const url = this.router.generate(route, params);
			window.open(url, '_blank');
		} else {
			this.router.navigateToRoute(route, params, { trigger: true });
		}
	}

	async createNewBookmark() {

		let mediaItem = this.mediaItem;
		let [dialog, destroy] = await this.compositionService.create('dialogs/bookmark-settings-dialog');
		let bookmark = { type: 'media-item', title: this.mediaItemTitle,
			item: {
				timeAdded: mediaItem.timeAdded,
				timeLastChanged: mediaItem.timeLastChanged,
				title: mediaItem.title,
				summary: mediaItem.summary,
				teaser: mediaItem.teaser,
				storyId: mediaItem.storyId,
				source: mediaItem.source,
				originalMultiMedia: mediaItem.originalMultiMedia,
				mediaItemType: mediaItem.mediaItemType,
				keywords: mediaItem.keywords,
				id: mediaItem.id,
				detectedLangCode: mediaItem.detectedLangCode,
			}
		};
		bookmark = await dialog.viewModel.new(bookmark);
		destroy();

		if(bookmark) {
			log.debug('New bookmark:', bookmark);
			try {
				await this.store.addBookmark(bookmark);
			} catch(e) {
				console.error('Error storing bookmark');
				console.error(e);
			}
		} else {
			log.info('Add bookmark dialog cancelled');
		}
	}

	relativeTime(from, to) {
		let duration = moment.duration(to-from);
		let str = ""
		if(duration.asSeconds() > 0) {
			str += "+ ";
			if(duration.days() > 0) str += duration.days() + "d ";
			if(duration.hours() > 0) str += duration.hours() + "h "
			if(duration.minutes() > 0) str += duration.minutes() + "m "
			if(duration.seconds() > 0) str += duration.seconds() + "s "
		} else if(duration.asSeconds() < 0) {
			str += "- ";
			if(duration.days() < 0) str += -duration.days() + "d ";
			if(duration.hours() < 0) str += -duration.hours() + "h "
			if(duration.minutes() < 0) str += -duration.minutes() + "m "
			if(duration.seconds() < 0) str += -duration.seconds() + "s "
		} else {
			// str = "";
		}
		return str;
	}

	selectMediaItem(mediaItem) {
		this.selectedMediaItem = mediaItem;
	}

	async viewMediaItem(mediaItem, event) {
		// current route name: this.routeConfig.name
		let route;
		const params = {
				mediaItemID: mediaItem.id
		};
		route = 'media-item'
		if(this.services.altTouch || event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) {
				// use any modifier as and excuse to open in separate tab/window
				const url = this.router.generate(route, params);
				window.open(url, '_blank');
		} else {
				this.router.navigateToRoute(route, params, { trigger: true });
		}
	}

	scrollToCurrent() {
		let table = jQuery(this.neighboursTable).children('.table-container');
		let rowElement = table.find('tr[data-itemid='+this.currentMediaItem.id+']');
		let top = rowElement.position().top;
		table.scrollTop(top - table.height()/2 + rowElement.height()/2);
	}

	videoLoaded() {
		let height = jQuery(this.videoSection).height();
		this.neighboursSection.style.top = height+"px";
		this.scrollToCurrent();
	}
}
