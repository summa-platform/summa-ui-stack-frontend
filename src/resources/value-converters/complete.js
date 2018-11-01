
export class CompleteValueConverter {
	toView(array, completeSet, value) {
		for(let key of Object.keys(completeSet)) {
			if(!completeSet[key]) {
				return array;
			}
		}
		return [value];
	}
}
