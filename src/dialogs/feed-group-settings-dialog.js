
export class FeedGroupSettingsDialog {

	async check(feedGroup, validate, resolve) {
		let result = await validate();
		if(result.valid) {
			resolve(feedGroup);
		}
	}
}
