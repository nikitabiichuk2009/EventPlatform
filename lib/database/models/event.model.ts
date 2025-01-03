import { Schema, models, model, Document } from "mongoose";

export interface IEvent extends Document {
  title: string;
  description: string;
  location: string;
  createdAt: Date;
  imageUrl: string;
  startDateTime: Date;
  endDateTime: Date;
  price: string;
  isFree: boolean;
  url: string;
  category: Schema.Types.ObjectId;
  organizer: Schema.Types.ObjectId;
}

const EventSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  imageUrl: { type: String, required: true },
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  price: { type: String, required: true },
  isFree: { type: Boolean, default: false },
  url: { type: String, required: true },
  category: { type: Schema.Types.ObjectId, ref: "Category" },
  organizer: { type: Schema.Types.ObjectId, ref: "User" },
});

const Event = models.Event || model<IEvent>("Event", EventSchema);

export default Event;
