_ = require('config').root.require('builders', 'utils')
inv = require '../lib/inv'
user = require '../lib/user'

module.exports =
  fetch: (req, res, next) ->
    # only fetch for session email
    # = only way to fetch private data on items
    user.getUserId(req.session.email)
    .then inv.byOwner
    .then (items)-> res.json items
    .fail (err)-> _.errorHandler res, err
    .done()

  put: (req, res, next) ->
    _.log req.params.id, 'Put Item ID'
    user.getUserId(req.session.email)
    .done (userId)->
      item = req.body
      item.owner = userId
      if inv.isValidItem item
        inv.db.put item
        .then (body)-> _.getObjIfSuccess inv.db, body
        .then (body)-> res.json 201, body
        .fail (err)-> _.errorHandler res, err
        .done()
      else
        _.errorHandler res, "couldn't add this item", 400

  # not used
  # get: (req, res, next) ->
  #   _.log req.params.id, 'GET Item ID'
  #   inv.get req.params.id
  #   .then (body)-> res.json(body)
  #   .fail (err)-> _.errorHandler res, err
  #   .done()

  del: (req, res, next) ->
    # missing req.session.email check isn't it?
    _.logBlue req.params, 'del'
    inv.db.delete req.params.id, req.params.rev
    .then (body)-> res.json(body)
    .fail (err)-> _.errorHandler res, err
    .done()

  publicByEntity: (req, res, next) ->
    _.logBlue req.params, 'public'
    inv.byEntity(req.params.uri)
    .then (items)-> res.json items
    .fail (err)-> _.errorHandler res, err
    .done()

  fetchLastPublicItems: (req, res, next) ->
    inv.publicByDate()
    .then (items)->
      _.logGreen items, 'public items'
      users = items.map (item)-> item.owner
      _.logGreen users = _.toSet(users), 'public items users'
      user.getUsersPublicData(users)
      .then (users)->
        res.json {items: items, users: users}
    .fail (err)-> _.errorHandler res, err
    .done()

  publicByUserAndSuffix: (req, res, next)->
    _.logBlue req.params, 'publicByUserAndSuffix'
    user.getSafeUserFromUsername(req.params.username)
    .then (user)->
      if user?._id?
        owner = user._id
        inv.publicByOwnerAndSuffix(owner, req.params.suffix)
        .then (items)->
          return res.json {items: items, user: user}
      else _.errorHandler res, 'user not found', 404
    .fail (err)-> _.errorHandler res, err
    .done()
