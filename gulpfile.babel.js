import { dest, series, src } from 'gulp';
import babel from 'gulp-babel';
import del from 'gulp-clean';
import eslint from 'gulp-eslint';
import sourcemaps from 'gulp-sourcemaps';

function build () {
	return src(['src/*.js', 'src/**/*.js'])
		.pipe(sourcemaps.init())
		.pipe(babel())
		.pipe(sourcemaps.write('.'))
		.pipe(dest('dist'));
}

function clean () {
	return src(['dist', 'reports'], { allowEmpty : true, read : false })
		.pipe(del());
}

function lint () {
	return src(['gulpfile.babel.js', 'src/**/*.js', 'test/**/*.js'])
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
}

exports.build = series(clean, build);
exports.clean = clean;
exports.default = series(clean, lint, build);
exports.lint = lint;
