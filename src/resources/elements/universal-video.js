import {bindable, observable, bindingMode} from 'aurelia-framework';
import log from 'logger';
import Hls from 'hls.js';

export class UniversalVideo {
	@bindable src;
	@bindable({defaultBindingMode: bindingMode.twoWay}) time;
	@bindable({defaultBindingMode: bindingMode.oneWayOut}) video;
	@bindable loaded;

	attached() {
		this.srcChanged();
	}

	timeUpdate() {
		this.time = this.__time = this.video.currentTime;	// __time: checkpoint to identify video element as the source of change
	}

	timeChanged(time) {
		if(this.__time !== time && this.video) {
			this.video.currentTime = time;
		}
	}

	loadVideo() {
		let isHLS = this.src && this.src.endsWith('.m3u8');
		log.debug('HLS:', isHLS);
		log.debug('Video:', this.video);
		if(isHLS && Hls.isSupported()) {
			var hls = new Hls();
			hls.loadSource(this.src);
			hls.attachMedia(this.video);
			hls.on(Hls.Events.MANIFEST_PARSED,function() {
				this.video.play();
			});
		// } else if(this.video.destroy) {
		} else {
			// this.video.destroy();
			this.video.attributes.src.value = this.src;
		}
	}

	videoChanged() {
		if(this.video && this.src) {
			this.loadVideo();
			this.video.addEventListener('loadedmetadata', (event) => {
				this.loaded({ $evt: event });
			});
		}
	}

	srcChanged(newValue, oldValue) {
		if(this.video && this.src) {
			if(this.video.destroy) {
				this.video.destroy();
			}
			this.loadVideo();
		}
	}
}

