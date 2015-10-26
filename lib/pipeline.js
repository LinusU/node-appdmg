
var events = require('events')

var Pipeline = function () {
  this.ee = null
  this.steps = []
  this.totalSteps = 0
  this.currentStep = 0

  this.cleanupList = []
  this.cleanupStore = {}
}

Pipeline.prototype._progress = function (obj) {
  obj.current = this.currentStep
  obj.total = this.totalSteps

  this.ee.emit('progress', obj)
}

Pipeline.prototype._runStep = function (step, nextAction, cb) {
  var that = this

  var next = function (err) {
    if (err) {
      that._progress({ type: 'step-end', status: 'error' })
      that.runRemainingCleanups(function (err2) {
        if (err2) console.error(err2)
        cb(err)
      })
    } else {
      that._progress({ type: 'step-end', status: 'ok' })
      that[nextAction](cb)
    }
  }

  next.skip = function () {
    that._progress({ type: 'step-end', status: 'skip' })
    that[nextAction](cb)
  }

  that.currentStep++
  that._progress({ type: 'step-begin', title: step.title })
  step.fn(next)
}

Pipeline.prototype.addStep = function (title, fn) {
  this.totalSteps++
  this.steps.push({ title: title, fn: fn })
}

Pipeline.prototype.addCleanupStep = function (id, title, fn) {
  this.cleanupList.push(id)
  this.cleanupStore[id] = { title: title, fn: fn }
}

Pipeline.prototype.expectAdditional = function (n) {
  this.totalSteps += n
}

Pipeline.prototype.runCleanup = function (id, cb) {
  var fn = this.cleanupStore[id].fn
  var idx = this.cleanupList.indexOf(id)

  if (idx === -1) throw new Error('No step with id: ' + id)

  delete this.cleanupStore[id]
  this.cleanupList.splice(idx, 1)

  return fn(cb)
}

Pipeline.prototype.runRemainingCleanups = function (cb) {
  if (this.cleanupList.length === 0) return cb(null)

  var that = this
  var idx = that.cleanupList.length - 1
  var id = that.cleanupList[idx]

  var step = {
    title: that.cleanupStore[id].title,
    fn: function (cb) { that.runCleanup(id, cb) }
  }

  that._runStep(step, 'runRemainingCleanups', cb)
}

Pipeline.prototype._run = function (cb) {
  if (this.steps.length === 0) return this.runRemainingCleanups(cb)

  var step = this.steps.shift()

  this._runStep(step, '_run', cb)
}

Pipeline.prototype.run = function () {
  var ee = new events.EventEmitter()
  this.ee = ee

  process.nextTick(this._run.bind(this, function (err) {
    if (err) {
      ee.emit('error', err)
    } else {
      ee.emit('finish')
    }
  }))

  return ee
}

module.exports = Pipeline
