import {inject, bindable, observable} from 'aurelia-framework';
import {Router, Redirect} from 'aurelia-router';
import log from 'logger';
import {Store} from 'store';
import {CompositionService} from 'composition-service';


@inject(Store, Router, CompositionService)
export class Trending {

	allQueries = [];
	@observable selectedQuery;
	newQueryModal = undefined;
	editQueryModal = undefined;

	constructor(store, router, compositionService) {
		this.store = store;
		this.router = router;
		this.compositionService = compositionService;
		this.store.getQueries().then(queries => this.allQueries = queries);
	}

	configureRouter(config, router) {
		this.router = router;
		config.title = 'Trending Stories';
		config.map([
			// { route: '', name: 'query-trending', moduleId: 'trending/trending', nav: false, title: 'Trending', settings: { } },
			{ route: '', redirect: 'all' },
			{ route: ':queryID', name: 'query-trending-id', moduleId: 'trending/trending2', nav: false, title: 'Trending', settings: { } },
			{ route: ':queryID/stories', name: 'stories', moduleId: 'trending/stories', nav: false, title: 'Stories', settings: { } },
			{ route: ':queryID/stories/:storyID', name: 'story', moduleId: 'trending/story', nav: false, title: 'Story', settings: { } },
			{ route: ':queryID/stories/:storyID/media-items/:mediaItemID', name: 'story-media-item',
				moduleId: 'trending/media-item', nav: false, title: 'Media Item', settings: { } },
			{ route: ':queryID/hours/:pastHour/media-items', name: 'hour-media-items',
				moduleId: 'trending/hour-media-items', nav: false, title: 'Hourly Media Items', settings: { } },
			{ route: ':queryID/hours/:pastHour/media-items/:mediaItemID', name: 'hour-media-item',
				moduleId: 'trending/media-item', nav: false, title: 'Media Item', settings: { } },

			{ route: 'feeds/:feedID/hours/:pastHour/media-items', name: 'feed-hour-media-items',
				moduleId: 'trending/hour-media-items', nav: false, title: 'Hourly Media Items', settings: { } },
			{ route: 'feeds/:feedID/hours/:pastHour/media-items/:mediaItemID', name: 'feed-hour-media-item',
				moduleId: 'trending/media-item', nav: false, title: 'Media Item', settings: { } },
			{ route: 'media-items/:mediaItemID', name: 'media-item',
				moduleId: 'trending/media-item', nav: false, title: 'Media Item', settings: { } },
		]);
	}

	async newQuery() {
		// this.router.navigateToRoute('reports', {hei:222});
		// return;
		// let query = await this.newQueryModal({ feedGroups: [] });
		let [dialog, destroy] = await this.compositionService.create('dialogs/query-settings-dialog');
		let query = await dialog.viewModel.new({ feedGroups: [] });
		destroy();

		if(query) {
			log.debug('New query yet to be stored:', query);
			query = await this.store.addQuery(query);
			log.debug('Stored query:', query);
			this.selectQuery(query);
		}
	}

	async editQuery(query) {
		log.debug('edit query:', query);
		if(query) {
			query = Object.assign({}, await this.store.getQuery(query.id));
		}
		log.debug('edit query:', query);
		// query = await this.editQueryModal(query);
		let [dialog, destroy] = await this.compositionService.create('dialogs/query-settings-dialog');
		dialog.viewModel.remove = (params) => { this.removeQuery(params.$model); };
		query = await dialog.viewModel.edit(query);
		destroy();

		if(query) {
			await this.store.saveQuery(query);
		}
	}

	async removeQuery(query) {
		log.debug('remove query:', query);
		let result = await this.store.removeQuery(query.id);
		this.selectedQuery = undefined;
	}

	async selectQuery(query) {
		log.debug('select query:', query);
		this.selectedQuery = query;
		let trending = await this.store.getQueryTrending(query.id);
		this.selectedQuery = Object.assign(this.selectedQuery, trending);
		trending = this.selectedQuery.trending;
		// console.log(trending)
		let trending2 = [];
		for(let entity in trending) {
			let mapping = trending[entity];
			let bins = []
			for(let i=0; i<24; ++i) {
				bins[i] = mapping[i-24] || 0;
			}
			trending2.push({entity, bins})
		}
		this.selectedQuery.trending = trending2;
		// console.log('TRENDING:', this.selectedQuery.trending);
		// console.log(this.selectedQuery);
		// if(feedGroup) {
		// 	this.selectedFeedGroup = Object.assign(feedGroup, await this.store.getFeedGroup(feedGroup._id));
		// }
	}

	storiesForQuery(query) {
		// log.debug('path:', this.router.generate('stories', { queryID: query.id, storyID: null, mediaID: null }));
		this.router.navigateToRoute('stories', { queryID: query.id, storyID: null, mediaID: null }, { trigger: true });
	}

}
