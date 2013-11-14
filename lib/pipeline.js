
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

Pipeline.prototype._statusStepOK = function () {
  process.stderr.write('[ OK ]\n');
};

Pipeline.prototype.addStep = function (title, fn) {
  this.totalSteps++;
  this.steps.push([title, fn]);
};

Pipeline.prototype.addCleanupStep = function (id, title, fn) {
  this.cleanupList.push(id);
  this.cleanupStore[id] = [title, fn];
};

Pipeline.prototype.expectAdditional = function (n) {
  this.totalSteps += n;
};

Pipeline.prototype.runCleanup = function (id, cb) {

  var that = this;

  var val = this.cleanupStore[id];
  var idx = this.cleanupList.indexOf(id);

  if (idx == -1) { throw new Error('No step with id: ' + id); }

  delete this.cleanupStore[id];
  this.cleanupList.splice(idx, 1);

  return val[1](cb);
};

Pipeline.prototype.runRemainingCleanups = function (cb) {
  if (this.cleanupList.length == 0) { return cb(null); }

  var that = this;
  var idx = that.cleanupList.length - 1;
  var id = that.cleanupList[idx];
  var title = that.cleanupStore[id][0];

  that._statusStepBegin(title);
  that.runCleanup(id, function (err) {
    if (err) {
      that._statusStepError();
      that.runRemainingCleanups(function (err2) {
        if (err2) { console.error(err2); }
        cb(err);
      });
    } else {
      that._statusStepOK();
      that.runRemainingCleanups(cb);
    }
  });

};

Pipeline.prototype.run = function (cb) {

  var that = this;

  if (that.steps.length) {
    var val = that.steps.shift();
    that._statusStepBegin(val[0]);
    val[1](function (err) {
      if (err) {
        that._statusStepError();
        that.runRemainingCleanups(function (err2) {
          if (err2) { console.error(err2); }
          cb(err);
        });
      } else {
        that._statusStepOK();
        that.run(cb);
      }
    });
  } else {
    that.runRemainingCleanups(cb);
  }

};

module.exports = exports = Pipeline;
