
export class FeedbackDialog {

	async check(feedback, validate, resolve) {
		let result = await validate();
		if(result.valid) {
			resolve(feedback);
		}
	}
}
