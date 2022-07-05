import eslint from 'gulp-eslint';
import gulp from 'gulp';

function lint () {
	return gulp.src(['gulpfile.js', 'src/**/*.js', 'test/**/*.js'])
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
}

export {
	lint
}

export default () => lint;
