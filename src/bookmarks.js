import {inject, bindable, observable, bindingMode} from 'aurelia-framework';
import log from 'logger';
import {Store} from 'store';
import {CompositionService} from 'composition-service';
import {Services} from 'services';


@inject(Store, CompositionService, Services)
export class Bookmarks {

	@observable filterText;
	@observable bookmarkType;
	bookmarks = [];
	selectedBookmark = undefined;

	constructor(store, compositionService, services) {
		this.store = store;
		this.compositionService = compositionService;
		this.services = services;
		this.store.getBookmarks().then(bookmarks => { this.allBookmarks = bookmarks; this.filterBookmarks(); });
		// this.bookmarkTypes = this.store.bookmarkTypes;
		this.store.getBookmarkTypes().then(bookmarkTypes => {
			this.bookmarkTypes = bookmarkTypes;
		});
	}

	filterBookmarks() {
		let text = this.filterText && this.filterText.toLocaleLowerCase();
		let search = prop => (prop && prop.toLocaleLowerCase().indexOf(text) != -1); // search in in property
		this.bookmarks = this.allBookmarks;
		if(this.bookmarkType) {
			this.bookmarks = this.bookmarks.filter(bookmark => {
				if(bookmark.type === this.bookmarkType) {
					return true;
				}
				return false;
			});
		}
		if(text) {
			this.bookmarks = this.bookmarks.filter(bookmark => {
				if(search(bookmark.title))
					return true;
				return false;
			});
		}
	}

	bookmarkTypeChanged() {
		this.filterBookmarks();
	}

	filterTextChanged() {
		this.filterBookmarks();
	}

	selectBookmark(bookmark) {
		this.selectedBookmark = bookmark;
	}

	async createNewBookmark() {
		
		let [dialog, destroy] = await this.compositionService.create('dialogs/bookmark-settings-dialog');
		let bookmark = { type: 'media-item' };
		bookmark = await dialog.viewModel.new(bookmark);
		destroy();

		if(bookmark) {
			log.debug('New bookmark:', bookmark);
			try {
				// await this.store.addBookmark(bookmark);
			} catch(e) {
				console.error('error storing bookmark');
				console.error(e);
			}
		} else {
			log.info('Add bookmark dialog cancelled');
		}
	}

	async removeBookmark(bookmark) {
		let [dialog, destroy] = await this.compositionService.create('dialogs/confirmation-dialog');
		// dialog.viewModel.remove = (params) => { this.removeUser(params.$model); };
		let result = await dialog.viewModel.open({
			title: `Delete Bookmark`,
			body: `Are you sure you want to delete bookmark created ${bookmark.timeAdded.utc().format('YYYY-MM-DD HH:mm [UTC]')} ?`,
			btnClass: 'danger',
			btnTitle: 'Delete Bookmark'
		});
		if(result) {
			try {
				log.debug('delete bookmark:', bookmark);
				let result = await this.store.removeBookmark(bookmark.id);
				this.selectedBookmark = undefined;
			} catch(e) {
				console.error(e);
			}
		}
	}

	async editBookmark(bookmark) {
		bookmark = Object.assign({}, bookmark);
		log.debug('Edit bookmark:', bookmark);
		let [dialog, destroy] = await this.compositionService.create('dialogs/bookmark-settings-dialog');
		// dialog.viewModel.remove = (params) => { this.removeBookmark(params.$model); };
		dialog.viewModel.remove = (params) => { this.removeBookmark(params.$model); };
		dialog.viewModel.model = bookmark;
		bookmark = await dialog.viewModel.edit(bookmark);
		destroy();

		if(bookmark) {
			log.debug('Edited bookmark yet to be stored:', bookmark);
			bookmark = await this.store.saveBookmark(bookmark);
			log.debug('Stored bookmark:', bookmark);
		}
	}

	async viewBookmark(bookmark, event) {
		if(!bookmark.type || bookmark.type == 'media-item') {
			let mediaItem = bookmark.item;
			if(!mediaItem || !mediaItem.id) {
				console.error('Invald bookmark');
				return;
			}

			// current route name: this.routeConfig.name
			const route = 'media-item';
			const params = {
				mediaItemID: mediaItem.id
			};

			// TODO: use router to generate url (route to sibling subrouter)
			let url = '#/trending/media-items/:mediaItemID';
			for(const param of Object.keys(params)) {
				let re = new RegExp(':'+param, 'g');
				url = url.replace(re, params[param])
			}

			if(this.services.altTouch || event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) {
				// use any modifier as and excuse to open in separate tab/window
				// const url = this.router.generate(route, params);
				window.open(url, '_blank');
			} else {
				// this.router.navigateToRoute(route, params, { trigger: true });
				window.location.href = url;
			}
		} else {
			console.error('Unsupported bookmark type!');
		}
	}
}
