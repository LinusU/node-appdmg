'use strict'

const EventEmitter = require('events').EventEmitter

class Pipeline {
  constructor () {
    this.steps = []
    this.totalSteps = 0
    this.currentStep = 0
    this.hasErrored = false

    this.cleanupList = []
    this.cleanupStore = {}
  }

  _runStep (step, nextAction, progress, done) {
    const next = (err) => {
      if (err) {
        progress({ type: 'step-end', status: 'error', current: this.currentStep, total: this.totalSteps })
        this.hasErrored = true
        this._runRemainingCleanups(function (err2) {
          if (err2) console.error(err2)
          done(err)
        })
      } else {
        progress({ type: 'step-end', status: 'ok', current: this.currentStep, total: this.totalSteps })
        this[nextAction](progress, done)
      }
    }

    next.skip = () => {
      progress({ type: 'step-end', status: 'skip', current: this.currentStep, total: this.totalSteps })
      this[nextAction](progress, done)
    }

    this.currentStep++
    progress({ type: 'step-begin', title: step.title, current: this.currentStep, total: this.totalSteps })
    step.fn(next)
  }

  addStep (title, fn) {
    this.totalSteps++
    this.steps.push({ title: title, fn: fn })
  }

  addCleanupStep (id, title, fn) {
    this.cleanupList.push(id)
    this.cleanupStore[id] = { title: title, fn: fn }
  }

  expectAdditional (n) {
    this.totalSteps += n
  }

  runCleanup (id, cb) {
    const fn = this.cleanupStore[id].fn
    const idx = this.cleanupList.indexOf(id)

    if (idx === -1) throw new Error(`No step with id: ${id}`)

    delete this.cleanupStore[id]
    this.cleanupList.splice(idx, 1)

    return fn(cb, this.hasErrored)
  }

  _runRemainingCleanups (progress, done) {
    if (this.cleanupList.length === 0) return done(null)

    const idx = this.cleanupList.length - 1
    const id = this.cleanupList[idx]

    const step = {
      title: this.cleanupStore[id].title,
      fn: (cb) => this.runCleanup(id, cb)
    }

    this._runStep(step, '_runRemainingCleanups', progress, done)
  }

  _run (progress, done) {
    if (this.steps.length === 0) return this._runRemainingCleanups(progress, done)

    const step = this.steps.shift()

    this._runStep(step, '_run', progress, done)
  }

  run () {
    const ee = new EventEmitter()

    function progress (data) {
      ee.emit('progress', data)
    }

    function done (err) {
      if (err) {
        ee.emit('error', err)
      } else {
        ee.emit('finish')
      }
    }

    process.nextTick(() => {
      this._run(progress, done)
    })

    return ee
  }
}

module.exports = Pipeline
