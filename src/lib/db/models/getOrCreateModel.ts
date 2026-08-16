// src/lib/db/models/getOrCreateModel.ts
import type { Connection, Model, Schema } from 'mongoose'

/** Mongoose throws "Cannot overwrite model once compiled" if `.model()` is
 * called twice with the same name on the same connection (e.g. across hot
 * reloads in dev, or multiple imports in tests). This guards that. */
export const getOrCreateModel = <T>(
  connection: Connection,
  name: string,
  schema: Schema,
  collection: string,
): Model<T> => {
  if (connection.models[name]) {
    return connection.models[name] as Model<T>
  }
  return connection.model<T>(name, schema, collection)
}
