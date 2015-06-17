CONFIG = require 'config'
__ = CONFIG.root
_ = __.require 'builders', 'utils'
Transaction = __.require 'models', 'transaction'
error_ = __.require 'lib', 'error/error'
promises_ = __.require 'lib', 'promises'
comments_ = __.require 'controllers', 'comments/lib/comments'
rightsVerification = require './rights_verification'

Radio = __.require 'lib', 'radio'
sideEffects = require('./side_effects')()

db = __.require('couch', 'base')('transactions')

module.exports = _.extend {}, rightsVerification,
  db: db
  byId: db.get.bind(db)
  byUser: (userId)->
    db.viewByKey 'byUser', userId

  create: (userId, item)->
    transaction = Transaction.create(userId, item)
    _.log transaction, 'transaction'
    db.post transaction

  addMessage: (userId, message, transactionId)->
    _.types arguments, 'strings...'
    if message?
      comments_.addTransactionComment(userId, message, transactionId)

  updateState: (newState, userId, transaction)->
    Transaction.testPossibleState transaction, newState
    db.update transaction._id, stateUpdater(newState, userId, transaction)
    .then -> Radio.emit 'transaction:update', transaction, newState

  markAsRead: (userId, transaction)->
    role = userRole userId, transaction
    # not handling cases when both user are connected:
    # should be clarified once sockets/server events will be implemented
    db.update transaction._id, markAsReadUpdater(role)

  updateReadForNewMessage: (userId, transaction)->
    updatedReadStates = updateReadStates userId, transaction
    # spares a db write if updatedReadStates is already the current read state object
    if _.sameObjects updatedReadStates, transaction.read then promises_.resolve()
    else db.update transaction._id, newMessageReadUpdater(updatedReadStates)


stateUpdater = (state, userId, transaction)->
  updatedReadStates = updateReadStates userId, transaction
  return updater = (doc)->
    doc.state = state
    doc.actions.push { action: state, timestamp: _.now() }
    doc.read = updatedReadStates
    return doc

newMessageReadUpdater = (updatedReadStates)->
  return updater = (doc)->
    doc.read = updatedReadStates
    return doc

markAsReadUpdater = (role)->
  return updater = (doc)->
    doc.read[role] = true
    return doc

updateReadStates = (userId, transaction)->
  role = userRole userId, transaction
  switch role
    when 'owner' then return {owner: true, requester: false}
    when 'requester' then return {owner: false, requester: true}
    else throw error_.new 'updateReadStates err', 500, arguments

userRole = (userId, transaction)->
  { owner, requester } = transaction
  if userId is owner then return 'owner'
  if userId is requester then return 'requester'
  return throw error_.new 'no role found', 500, arguments
