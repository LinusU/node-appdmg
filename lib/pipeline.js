
var Pipeline = function () {

  this.steps = [];
  this.totalSteps = 0;
  this.currentStep = 0;

  this.cleanupList = [];
  this.cleanupStore = {};

};

Pipeline.prototype._statusStepBegin = function (title) {
  var line =  '[' + (this.currentStep < 9 ? ' ' : '') + (++this.currentStep) + '/' + this.totalSteps + '] ' + title + '...';
  process.stderr.write(line + String.repeat(' ', 45 - line.length));
};

Pipeline.prototype._statusStepError = function () {
  process.stderr.write('[FAIL]\n');
};

Pipeline.prototype._statusStepSkip = function () {
  process.stderr.write('[SKIP]\n');
};

Pipeline.prototype._statusStepOK = function () {
  process.stderr.write('[ OK ]\n');
};

Pipeline.prototype._runStep = function (step, nextAction, cb) {
  var that = this;

  var next = function (err) {
    if (err) {
      that._statusStepError();
      that.runRemainingCleanups(function (err2) {
        if (err2) { console.error(err2); }
        cb(err);
      });
    } else {
      that._statusStepOK();
      that[nextAction](cb);
    }
  };

  next.skip = function () {
    that._statusStepSkip();
    that[nextAction](cb);
  };

  that._statusStepBegin(step.title);
  step.fn(next);

};

Pipeline.prototype.addStep = function (title, fn) {
  this.totalSteps++;
  this.steps.push({ title: title, fn: fn });
};

Pipeline.prototype.addCleanupStep = function (id, title, fn) {
  this.cleanupList.push(id);
  this.cleanupStore[id] = { title: title, fn: fn };
};

Pipeline.prototype.expectAdditional = function (n) {
  this.totalSteps += n;
};

Pipeline.prototype.runCleanup = function (id, cb) {

  var that = this;

  var fn = this.cleanupStore[id].fn;
  var idx = this.cleanupList.indexOf(id);

  if (idx == -1) { throw new Error('No step with id: ' + id); }

  delete this.cleanupStore[id];
  this.cleanupList.splice(idx, 1);

  return fn(cb);
};

Pipeline.prototype.runRemainingCleanups = function (cb) {
  if (this.cleanupList.length === 0) { return cb(null); }

  var that = this;
  var idx = that.cleanupList.length - 1;
  var id = that.cleanupList[idx];

  var step = {
    title: that.cleanupStore[id].title,
    fn: function (cb) { that.runCleanup(id, cb); }
  };

  that._runStep(step, 'runRemainingCleanups', cb);
};

Pipeline.prototype.run = function (cb) {
  if (this.steps.length === 0) { return this.runRemainingCleanups(cb); }

  var step = this.steps.shift();

  this._runStep(step, 'run', cb);
};

module.exports = exports = Pipeline;
