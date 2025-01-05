"use server";

import { connectToDB } from "../database";
import User from "../database/models/user.model";
import Event from "../database/models/event.model";
import Category from "../database/models/category.model";
import { CreateEventParams, GetAllEventsParams, UpdateEventParams } from "@/types";
import { revalidatePath } from "next/cache";
import Order from "../database/models/order.model";

export async function createEvent({ userId, event, path }: CreateEventParams): Promise<void> {
  try {
    await connectToDB();

    const organizer = await User.findById(userId);
    if (!organizer) {
      throw new Error("Organizer not found");
    }

    // Check if category exists, if not, create it with the user as a follower
    const category = await Category.findOneAndUpdate(
      { name: event.category },
      {
        $setOnInsert: {
          name: event.category, // Create new category if not found
          followers: [organizer._id],
          events: [],
        },
      },
      { upsert: true, new: true } // Upsert and return the document
    );

    // Ensure the user is added to the followers list if not already
    await Category.updateOne(
      { _id: category._id },
      { $addToSet: { followers: organizer._id } }
    );

    const newEvent = await Event.create({
      title: event.title,
      description: event.description,
      location: event.location,
      imageUrl: event.imageUrl,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      price: event.price,
      isFree: event.isFree,
      url: event.url,
      category: category._id,
      organizer: organizer._id,
    });

    await Category.updateOne(
      { _id: category._id },
      { $addToSet: { events: newEvent._id } }
    );

    revalidatePath(path);

  } catch (error) {
    console.error("Error creating event:", error);
    throw new Error("Error creating event");
  }
}

export async function updateEvent({
  userId,
  event,
  path,
}: UpdateEventParams): Promise<void> {
  try {
    await connectToDB();

    const existingEvent = await Event.findById(event._id).populate({
      path: "organizer",
      model: User,
    }).populate({
      path: "category",
      model: Category,
    });

    if (!existingEvent) {
      throw new Error("Event not found");
    }

    if (existingEvent.organizer.clerkId !== userId) {
      throw new Error("You are not authorized to update this event");
    }

    const newCategory = await Category.findOneAndUpdate(
      { name: event.category },
      {
        $setOnInsert: {
          name: event.category,
          followers: [existingEvent.organizer._id],
          events: [],
        },
      },
      { upsert: true, new: true }
    );
    console.log({ existingEventCategoryName: existingEvent.category.name, newCategoryName: newCategory.name });
    const isCategoryChanged = existingEvent.category.name !== newCategory.name;

    await Category.updateOne(
      { _id: newCategory._id },
      { $addToSet: { followers: existingEvent.organizer._id } }
    );

    // If the category has changed, remove the event from the old category
    if (isCategoryChanged) {
      await Category.updateOne(
        { _id: existingEvent.category },
        { $pull: { events: existingEvent._id } }
      );
    }
    const updatedEvent = await Event.findByIdAndUpdate(
      event._id,
      {
        title: event.title,
        description: event.description,
        location: event.location,
        imageUrl: event.imageUrl,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        price: event.price,
        isFree: event.isFree,
        url: event.url,
        category: newCategory._id,
      },
      { new: true }
    );

    if (!updatedEvent) {
      throw new Error("Error updating event");
    }

    await Category.updateOne(
      { _id: newCategory._id },
      { $addToSet: { events: updatedEvent._id } }
    );

    revalidatePath(path);
  } catch (error) {
    console.error("Error updating event:", error);
    throw new Error("Error updating event");
  }
}


export async function getAllEvents({
  query = "",
  category = "", // Accepted but not processed for now
  limit = 10,
  page = 1,
}: GetAllEventsParams): Promise<{
  allEvents: any[];
  isNextPage: boolean;
  totalEventsCount: number;
}> {
  try {
    await connectToDB();
    const skip = (page - 1) * limit;

    const searchQuery: any = {};
    if (query) {
      searchQuery.title = { $regex: query, $options: "i" };
    }

    let sortOption = {};
    switch (category) {
      case "popular":
        sortOption = { savedCount: -1 };
        break;
      case "recent":
        sortOption = { createdAt: -1 };
        break;
      case "name":
        sortOption = { name: 1 };
        break;
      case "old":
        sortOption = { createdAt: 1 };
        break;
      case "free":
        searchQuery.isFree = true;
        sortOption = { createdAt: -1 };
        break;
      case "cheapest":
        sortOption = { price: 1 };
        break;
      case "most-expensive":
        sortOption = { price: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    const allEvents = await Event.find(searchQuery)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate({ path: "organizer", model: User })
      .populate({ path: "category", model: Category })
      .exec();

    const totalEventsCount = await Event.countDocuments(searchQuery);
    const totalEventsCountWithoutQuery = await Event.countDocuments();
    const isNextPage = totalEventsCount > skip + allEvents.length;

    return { allEvents, isNextPage, totalEventsCount: totalEventsCountWithoutQuery };
  } catch (err: any) {
    console.error("Error fetching all events:", err);
    throw new Error("Error fetching all events");
  }
}

export async function getEventById(eventId: string) {
  try {
    await connectToDB();

    const event = await Event.findById(eventId)
      .populate({ path: "organizer", model: User })
      .populate({ path: "category", model: Category })
      .exec();

    if (!event) {
      throw new Error("Event not found");
    }

    return event;
  } catch (err) {
    console.error("Error fetching event by ID:", err);
    throw new Error("Error fetching event by ID");
  }
}

export async function deleteEventById(eventId: string): Promise<void> {
  try {
    await connectToDB();

    const event = await Event.findById(eventId).populate({
      path: "category",
      select: "_id",
      model: Category
    });
    if (!event) {
      throw new Error("Event not found");
    }

    await Category.updateOne(
      { _id: event.category },
      { $pull: { events: event._id } }
    );

    await User.updateMany(
      { savedEvents: event._id },
      { $pull: { savedEvents: event._id } }
    );

    await Order.deleteMany({ event: event._id });

    await Event.findByIdAndDelete(eventId);

    revalidatePath("/saved")
    revalidatePath("/")
    revalidatePath(`/categories/${event.category._id.toString()}`)

    console.log(`Event with ID ${eventId} deleted successfully.`);
  } catch (error) {
    console.error("Error deleting event:", error);
    throw new Error("Error deleting event");
  }
}
