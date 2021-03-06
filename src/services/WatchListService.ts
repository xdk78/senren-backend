import User from '../entity/User'
import WatchList, { StatusNumber } from '../entity/WatchList'
import BaseService from './BaseService'
import SeriesService from './SeriesService'
import SeriesState from '../entity/series/SeriesState'
import Series from '../entity/series/Series'
import { AppInstance } from '../'
import { Connection } from 'mongoose'
import { ObjectId } from 'mongodb'
import { getModelForClass, Ref } from '@typegoose/typegoose'

export default class WatchListService implements BaseService {
  connection: Connection
  fastify: AppInstance
  seriesService: SeriesService

  constructor(fastify: AppInstance) {
    this.connection = fastify.mongo.db
    this.seriesService = new SeriesService(fastify)
  }

  async getWatchList(userId: ObjectId): Promise<object> {
    try {
      const userModel = getModelForClass(User, { existingConnection: this.connection })
      const user = await userModel.findOne({ _id: userId })
      if (!user) {
        throw new Error('Could not find user')
      } else {
        const watchListModel = getModelForClass(WatchList, { existingConnection: this.connection })
        const seriesStateModel = getModelForClass(SeriesState, { existingConnection: this.connection })
        const seriesModel = getModelForClass(Series, { existingConnection: this.connection })

        const watchListRefs = await watchListModel.findOne({ _id: user.watchList }).populate([
          {
            path: 'watching',
            model: seriesStateModel,
            populate: {
              path: 'series',
              model: seriesModel,
            },
          },
          {
            path: 'completed',
            model: seriesStateModel,
            populate: {
              path: 'series',
              model: seriesModel,
            },
          },
          {
            path: 'onHold',
            model: seriesStateModel,
            populate: {
              path: 'series',
              model: seriesModel,
            },
          },
          {
            path: 'dropped',
            model: seriesStateModel,
            populate: {
              path: 'series',
              model: seriesModel,
            },
          },
          {
            path: 'planToWatch',
            model: seriesStateModel,
            populate: {
              path: 'series',
              model: seriesModel,
            },
          },
        ])
        return watchListRefs
      }
    } catch (error) {
      throw error
    }
  }

  async addToWatchList(userId: ObjectId, status: StatusNumber, payload: SeriesState): Promise<any> {
    try {
      const userModel = getModelForClass(User, { existingConnection: this.connection })
      const user = await userModel.findOne({ _id: userId })
      if (user) {
        const { series, seasonNumber, episodeNumber } = payload
        if (await this.seriesService.doesExist(series)) {
          const watchListModel = getModelForClass(WatchList, { existingConnection: this.connection })
          const seriesStateModel = getModelForClass(SeriesState, { existingConnection: this.connection })

          const seriesState = await seriesStateModel.create({
            series: series,
            seasonNumber: seasonNumber,
            episodeNumber: episodeNumber,
          })

          const list = await watchListModel.findOne({ _id: user.watchList }).populate([
            { path: 'watching', model: seriesStateModel, select: { series: series } },
            { path: 'completed', model: seriesStateModel, select: { series: series } },
            { path: 'onHold', model: seriesStateModel, select: { series: series } },
            { path: 'dropped', model: seriesStateModel, select: { series: series } },
            { path: 'planToWatch', model: seriesStateModel, select: { series: series } },
          ])

          const reducedList = [].concat(
            ...list.watching,
            ...list.completed,
            ...list.onHold,
            ...list.dropped,
            ...list.planToWatch
          )

          if (reducedList.find((item) => (item.series.toString() === series.toString() ? true : false))) {
            throw new Error('Series exist on the watchlist')
          } else {
            switch (status) {
              case StatusNumber.watching:
                await watchListModel.addToWatching(user.watchList, seriesState._id)
                break
              case StatusNumber.onHold:
                await watchListModel.addToOnHold(user.watchList, seriesState._id)
                break
              case StatusNumber.dropped:
                await watchListModel.addToDropped(user.watchList, seriesState._id)
                break
              case StatusNumber.completed:
                await watchListModel.addToCompleted(user.watchList, seriesState._id)
                break
              case StatusNumber.planToWatch:
                await watchListModel.addToPlanToWatch(user.watchList, seriesState._id)
                break
              default:
                throw new Error('Wrong status')
            }
          }
        } else {
          throw new Error('Series does not exist')
        }
      } else {
        throw new Error('Could not find user')
      }
    } catch (error) {
      throw error
    }
  }

  async removeFromWatchList(userId: ObjectId, status: StatusNumber, seriesStateId: Ref<SeriesState>): Promise<any> {
    try {
      const userModel = getModelForClass(User, { existingConnection: this.connection })
      const user = await userModel.findOne({ _id: userId })
      if (user) {
        const watchListModel = getModelForClass(WatchList, { existingConnection: this.connection })

        switch (status) {
          case StatusNumber.watching:
            if (await watchListModel.findOne({ watching: seriesStateId })) {
              await watchListModel.removeFromWatching(user.watchList, seriesStateId)
            } else {
              throw new Error('Could not find seriesState')
            }
            break
          case StatusNumber.onHold:
            if (await watchListModel.findOne({ onHold: seriesStateId })) {
              await watchListModel.removeFromOnHold(user.watchList, seriesStateId)
            } else {
              throw new Error('Could not find seriesState')
            }
            break
          case StatusNumber.dropped:
            if (await watchListModel.findOne({ dropped: seriesStateId })) {
              await watchListModel.removeFromDropped(user.watchList, seriesStateId)
            } else {
              throw new Error('Could not find seriesState')
            }
            break
          case StatusNumber.completed:
            if (await watchListModel.findOne({ completed: seriesStateId })) {
              await watchListModel.removeFromCompleted(user.watchList, seriesStateId)
            } else {
              throw new Error('Could not find seriesState')
            }
            break
          case StatusNumber.planToWatch:
            if (await watchListModel.findOne({ planToWatch: seriesStateId })) {
              await watchListModel.removeFromPlanToWatch(user.watchList, seriesStateId)
            } else {
              throw new Error('Could not find seriesState')
            }
            break
          default:
            throw new Error('Wrong status')
        }
      } else {
        throw new Error('Could not find user')
      }
    } catch (error) {
      throw error
    }
  }

  async updateWatchList(
    userId: ObjectId,
    status: StatusNumber,
    seriesStateId: ObjectId,
    payload: SeriesState
  ): Promise<any> {
    try {
      const userModel = getModelForClass(User, { existingConnection: this.connection })
      const user = await userModel.findOne({ _id: userId })
      if (user) {
        const watchListModel = getModelForClass(WatchList, { existingConnection: this.connection })
        const seriesStateModel = getModelForClass(SeriesState, { existingConnection: this.connection })
        const { series, seasonNumber, episodeNumber } = payload

        switch (status) {
          case StatusNumber.watching:
            if (await watchListModel.findOne({ watching: seriesStateId })) {
              const newSeriesState = await seriesStateModel.findOneAndUpdate(
                {
                  _id: seriesStateId,
                },
                {
                  $set: {
                    series: series,
                    seasonNumber: seasonNumber,
                    episodeNumber: episodeNumber,
                  },
                }
              )

              await watchListModel.findOneAndUpdate(
                { _id: user.watchList, watching: seriesStateId },
                { $set: { watching: newSeriesState } }
              )
              return newSeriesState
            }
            throw new Error('Could not find seriesState')

          case StatusNumber.onHold:
            if (await watchListModel.findOne({ onHold: payload })) {
              const newSeriesState = await seriesStateModel.findOneAndUpdate(
                {
                  _id: seriesStateId,
                },
                {
                  $set: {
                    series: series,
                    seasonNumber: seasonNumber,
                    episodeNumber: episodeNumber,
                  },
                }
              )

              await watchListModel.findOneAndUpdate(
                { _id: user.watchList, onHold: seriesStateId },
                { $set: { onHold: newSeriesState } },
                { upsert: true }
              )
              return newSeriesState
            }
            throw new Error('Could not find seriesState')

          case StatusNumber.dropped:
            if (await watchListModel.findOne({ dropped: payload })) {
              const newSeriesState = await seriesStateModel.findOneAndUpdate(
                {
                  _id: seriesStateId,
                },
                {
                  $set: {
                    series: series,
                    seasonNumber: seasonNumber,
                    episodeNumber: episodeNumber,
                  },
                }
              )

              await watchListModel.findOneAndUpdate(
                { _id: user.watchList, dropped: seriesStateId },
                { $set: { dropped: newSeriesState } },
                { upsert: true }
              )
              return newSeriesState
            }
            throw new Error('Could not find seriesState')

          case StatusNumber.completed:
            if (await watchListModel.findOne({ completed: payload })) {
              const newSeriesState = await seriesStateModel.findOneAndUpdate(
                {
                  _id: seriesStateId,
                },
                {
                  $set: {
                    series: series,
                    seasonNumber: seasonNumber,
                    episodeNumber: episodeNumber,
                  },
                }
              )

              await watchListModel.findOneAndUpdate(
                { _id: user.watchList, completed: seriesStateId },
                { $set: { completed: newSeriesState } },
                { upsert: true }
              )
              return newSeriesState
            }
            throw new Error('Could not find seriesState')

          case StatusNumber.planToWatch:
            if (await watchListModel.findOne({ planToWatch: payload })) {
              const newSeriesState = await seriesStateModel.findOneAndUpdate(
                {
                  _id: seriesStateId,
                },
                {
                  $set: {
                    series: series,
                    seasonNumber: seasonNumber,
                    episodeNumber: episodeNumber,
                  },
                }
              )

              await watchListModel.findOneAndUpdate(
                { _id: user.watchList, planToWatch: seriesStateId },
                { $set: { planToWatch: newSeriesState } },
                { upsert: true }
              )
              return newSeriesState
            }
            throw new Error('Could not find seriesState')

          default:
            throw new Error('Wrong status')
        }
      } else {
        throw new Error('Could not find user')
      }
    } catch (error) {
      throw error
    }
  }
}
