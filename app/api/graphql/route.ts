import { createSchema, createYoga } from "graphql-yoga";
import { GraphQLScalarType, Kind } from "graphql";
import GraphQLJSON from "graphql-type-json";
import { PrismaClient, Role } from "@prisma/client";
const prisma = new PrismaClient();

import bcrypt from "bcrypt";

const dateScalar = new GraphQLScalarType({
  name: "Date",
  description: "Date custom scalar type",
  serialize(value) {
    if (value instanceof Date) {
      return value.getTime(); // Convert outgoing Date to integer for JSON
    }
    throw Error("GraphQL Date Scalar serializer expected a `Date` object");
  },
  parseValue(value) {
    if (typeof value === "number") {
      return new Date(value); // Convert incoming integer to Date
    }
    throw new Error("GraphQL Date Scalar parser expected a `number`");
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      // Convert hard-coded AST string to integer and then to Date
      return new Date(parseInt(ast.value, 10));
    }
    // Invalid hard-coded value (not an integer)
    return null;
  },
});

const dateTimeScalar = new GraphQLScalarType({
  // Name of the scalar type
  name: "DateTime",

  // Description of the scalar type
  description: "A custom scalar type for date and time values.",

  // Function to serialize the value when sending data to the client
  serialize(value) {
    // Check if the provided value is a Date object
    if (value instanceof Date) {
      // Convert the Date object to an ISO string format for JSON
      return value.toISOString();
    }
    // If the value is not a Date object, throw an error
    throw new Error("GraphQL DateTime serializer expected a `Date` object");
  },

  // Function to parse the value received from the client
  parseValue(value: unknown): Date {
    // Check if the incoming value is either a string or a number
    if (typeof value === "string" || typeof value === "number") {
      // Create a new Date object from the incoming value
      const date = new Date(value);
      // Check if the created Date is valid
      if (!isNaN(date.getTime())) {
        // Return the valid Date object
        return date;
      }
    }
    // If the value is invalid, throw an error
    throw new Error(
      "GraphQL DateTime parser expected a valid date string or timestamp"
    );
  },

  // Function to parse literal values in the GraphQL query
  parseLiteral(ast) {
    // Check if the AST node kind is a string
    if (ast.kind === Kind.STRING) {
      // Create a new Date object from the AST value
      const date = new Date(ast.value);
      // Check if the created Date is valid
      if (!isNaN(date.getTime())) {
        // Return the valid Date object
        return date;
      }
    }
    // If the value is invalid, return null
    return null; // Invalid hard-coded value
  },
});

const { handleRequest } = createYoga({
  schema: createSchema({
    typeDefs: /* GraphQL */ `
      scalar Date
      scalar DateTime
      scalar JSON
      # Represents different user roles in the application.
      enum Role {
        ADMIN # Admin user with elevated permissions.
        MODERATOR # Moderator with limited administrative capabilities.
        USER # Regular user with standard access.
      }

      # Represents the condition of a product.
      enum Condition {
        BRAND_NEW # Product is brand new and unused.
        TRIED_ON # Product has been tried on but not used.
        NEW_WITH_DEFECTS # New product that has some defects.
        NEW_WITH_TAGS # New product that is still in its original packaging with tags.
        NEW_WITHOUT_TAGS # New product that has no tags but is unused.
        USED # Product has been used.
        IN_BOX # Product is in its original box.
        NO_BOX # Product is without its original box.
      }

      # Represents the different ways a raffle can be entered.
      enum RaffleType {
        IN_APP # Raffle can be entered within the app.
        ONLINE # Raffle can be entered online through a website.
        IN_STORE # Raffle can be entered at physical store locations.
      }

      # Represents the current status of a raffle.
      enum RaffleStatus {
        OPEN # Raffle is currently accepting entries.
        CLOSED # Raffle has closed and is no longer accepting entries.
        CANCELED # Raffle has been canceled and will not take place.
      }

      # Represents the different types of reactions a user can give.
      enum ReactionType {
        LIKE # Simple like reaction.
        LOVE # Love reaction, expressing strong approval.
        WOW # Wow reaction, expressing amazement.
        SAD # Sad reaction, expressing disappointment.
        ANGRY # Angry reaction, expressing frustration.
        CHEER # Cheer reaction, expressing encouragement.
        LAUGH # Laugh reaction, expressing amusement.
        SURPRISE # Surprise reaction, expressing unexpectedness.
        DISLIKE # Dislike reaction, expressing disapproval.
        CONFUSED # Confused reaction, expressing uncertainty.
        GRATEFUL # Grateful reaction, expressing thankfulness.
        APPLAUD # Applaud reaction, expressing appreciation.
      }

      type User {
        id: Int! # Unique user ID. Int is a signed 32-bit integer and cannot be null.
        email: String! # User's email address. String cannot be null.
        password: String! # User's hashed password. String cannot be null.
        role: Role! # User's role (ADMIN, MODERATOR, USER). Role cannot be null.
        username: String! # User's unique username. String cannot be null.
        products: [Product!]! # List of user's products. The list cannot be null, and each Product cannot be null.
        favorites: [Product!] # User's favorite products. The list can be null, and each Product can also be null.
        viewedProducts: [Product!] # List of viewed products. The list can be null, and each Product can also be null.
        searchHistory: [SearchHistory!] # User's search history. The list can be null, and each SearchHistory object can also be null.
        createdAt: DateTime! # Account creation timestamp. DateTime cannot be null.
        profilePicture: String # URL to user's profile picture. String can be null.
        lastActive: DateTime # Timestamp of last activity. DateTime can be null.
        following: [UserFollow!] # Users this user follows. The list can be null, and each UserFollow object can also be null.
        followers: [UserFollow!] # Users following this user. The list can be null, and each UserFollow object can also be null.
        threads: [Thread!]! # Discussion threads created by the user. The list cannot be null, and each Thread cannot be null.
        posts: [Post!]! # Posts created by the user. The list cannot be null, and each Post cannot be null.
        comments: [Comment!] # User's comments. The list can be null, and each Comment can also be null.
        userBadges: [UserBadge!] # Badges earned by the user. The list can be null, and each UserBadge can also be null.
        supportTickets: [SupportTicket!] # Support tickets created by the user. The list can be null, and each SupportTicket can also be null.
      }

      type UserFollow {
        id: Int! # Unique ID for the follow relationship. Int is a signed 32-bit integer.
        followerId: Int! # ID of the user who follows. Int is a signed 32-bit integer.
        followedId: Int! # ID of the user being followed. Int is a signed 32-bit integer.
        follower: User # User who follows. The User object can be null.
        followed: User # User being followed. The User object can be null.
      }

      type UserRating {
        id: Int! # Unique rating ID. Int is a signed 32-bit integer.
        raterId: Int! # ID of the user giving the rating. Int is a signed 32-bit integer.
        ratedId: Int! # ID of the user or product being rated. Int is a signed 32-bit integer.
        rating: Int! # Rating value (e.g., 1-5). Int is a signed 32-bit integer.
        rater: User # User who gave the rating. The User object can be null.
        rated: User # User or product that received the rating. The User object can be null.
      }

      type UserBadge {
        id: Int # Unique badge ID (optional). Int is a signed 32-bit integer.
        userId: Int # ID of the user who earned the badge. Int is a signed 32-bit integer (optional).
        badgeId: Int # ID of the badge. Int is a signed 32-bit integer (optional).
        createdAt: DateTime! # Timestamp when the badge was earned. DateTime is a custom scalar type.
        user: User # User associated with the badge. The User object can be null.
        badge: Badge # Badge details. The Badge object can be null.
      }

      type UserActivity {
        id: Int! # Unique activity ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user performing the action. Int is a signed 32-bit integer.
        action: Int! # Action type (represented as an integer). Int is a signed 32-bit integer.
        createdAt: DateTime! # Timestamp of the activity. DateTime is a custom scalar type.
        user: User # User associated with the activity. The User object can be null.
        badge: Badge # Badge related to the activity (if any). The Badge object can be null.
      }

      type Notification {
        id: Int! # Unique notification ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user receiving the notification. Int is a signed 32-bit integer.
        message: String! # Notification message content. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the notification was created. DateTime is a custom scalar type.
        read: Boolean # Indicates if the notification has been read. Boolean is true or false.
        user: User # User associated with the notification. The User object can be null.
      }

      type Product {
        id: Int! # Unique product ID. Int is a signed 32-bit integer.
        title: String! # Product title. String is a UTF-8 character sequence.
        description: String! # Detailed description of the product. String is a UTF-8 character sequence.
        price: Float! # Product price. Float is a signed double-precision floating-point value.
        condition: Condition! # Condition of the product (e.g., new, used). Condition is an enum.
        createdAt: DateTime! # Timestamp when the product was created. DateTime is a custom scalar type.
        listedAt: DateTime! # Timestamp when the product was listed. DateTime is a custom scalar type.
        soldAt: DateTime # Timestamp when the product was sold (optional). DateTime is a custom scalar type.
        releaseDate: DateTime # Release date of the product (optional). DateTime is a custom scalar type.
        sellerId: Int! # ID of the seller. Int is a signed 32-bit integer.
        seller: User! # Seller information. The User object must be non-null.
        favoritedBy: [User!]! # Users who favorited the product. The list cannot be null, and each User must also be non-null.
        viewedBy: [User!]! # Users who viewed the product. The list cannot be null, and each User must also be non-null.
        priceHistory: [PriceHistory!]! # Historical price data for the product. The list cannot be null, and each PriceHistory must also be non-null.
        hasRaffle: Boolean! # Indicates if there's an active raffle. Boolean is true or false.
        raffles: [Raffle!]! # List of raffles associated with the product. The list cannot be null, and each Raffle must also be non-null.
        media: [Media!]! # Media (images, videos) related to the product. The list cannot be null, and each Media must also be non-null.
        countryId: Int # ID of the country where the product is listed. Int is a signed 32-bit integer (optional).
        country: Country # Country information. The Country object can be null.
        brandId: Int # ID of the product's brand. Int is a signed 32-bit integer (optional).
        brand: Brand # Brand details. The Brand object can be null.
        ratings: [ProductRating!]! # Ratings given to the product. The list cannot be null, and each ProductRating must also be non-null.
        reports: [Report!]! # Reports filed against the product. The list cannot be null, and each Report must also be non-null.
        comments: [Comment!]! # Comments made on the product. The list cannot be null, and each Comment must also be non-null.
        wishlistedBy: [Wishlist!]! # Users who wishlisted the product. The list cannot be null, and each Wishlist must also be non-null.
        reviews: [Review!]! # Reviews for the product. The list cannot be null, and each Review must also be non-null.
        engagementMetrics: [EngagementMetric!]! # Metrics tracking user engagement. The list cannot be null, and each EngagementMetric must also be non-null.
        tags: [ProductTag!]! # Tags associated with the product. The list cannot be null, and each ProductTag must also be non-null.
        variants: [ProductVariant!]! # Variants of the product (e.g., sizes, colors). The list cannot be null, and each ProductVariant must also be non-null.
        bundles: [BundleProduct!]! # Bundles that include this product. The list cannot be null, and each BundleProduct must also be non-null.
      }

      type Country {
        id: Int! # Unique country ID. Int is a signed 32-bit integer.
        name: String! # Name of the country. String is a UTF-8 character sequence.
        products: [Product!]! # Products listed in this country. The list cannot be null, and each Product must also be non-null.
      }

      type Brand {
        id: Int! # Unique brand ID. Int is a signed 32-bit integer.
        name: String! # Name of the brand. String is a UTF-8 character sequence.
        products: [Product!]! # Products associated with this brand. The list cannot be null, and each Product must also be non-null.
      }

      type PriceHistory {
        id: Int! # Unique price history entry ID. Int is a signed 32-bit integer.
        productId: Int! # ID of the associated product. Int is a signed 32-bit integer.
        price: Float! # Price at this point in history. Float is a signed double-precision floating-point value.
        createdAt: DateTime! # Timestamp of this price record. DateTime is a custom scalar type.
        product: Product! # Product details. The Product object must be non-null.
      }

      type Raffle {
        id: Int! # Unique raffle ID. Int is a signed 32-bit integer.
        title: String! # Raffle title. String is a UTF-8 character sequence.
        description: String! # Description of the raffle. String is a UTF-8 character sequence.
        type: RaffleType! # Type of the raffle (e.g., online, in-store). RaffleType is an enum.
        status: RaffleStatus! # Current status of the raffle. RaffleStatus is an enum.
        createdAt: DateTime! # Timestamp when the raffle was created. DateTime is a custom scalar type.
        endsAt: DateTime! # End time for the raffle. DateTime is a custom scalar type.
        productId: Int! # ID of the product associated with the raffle. Int is a signed 32-bit integer.
        product: Product! # Product details. The Product object must be non-null.
        entries: [RaffleEntry!]! # Entries submitted for the raffle. The list cannot be null, and each RaffleEntry must also be non-null.
      }

      type RaffleEntry {
        id: Int! # Unique entry ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user entering the raffle. Int is a signed 32-bit integer.
        raffleId: Int! # ID of the associated raffle. Int is a signed 32-bit integer.
        createdAt: DateTime! # Timestamp when the entry was created. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
        raffle: Raffle! # Raffle details. The Raffle object must be non-null.
      }

      type Media {
        id: Int! # Unique media ID. Int is a signed 32-bit integer.
        productId: Int! # ID of the associated product. Int is a signed 32-bit integer.
        url: String! # URL of the media (image, video). String is a UTF-8 character sequence.
        type: String! # Type of media (e.g., image, video). String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the media was created. DateTime is a custom scalar type.
        product: Product! # Product details. The Product object must be non-null.
      }

      type Comment {
        id: Int! # Unique comment ID. Int is a signed 32-bit integer.
        productId: Int! # ID of the associated product. Int is a signed 32-bit integer.
        userId: Int! # ID of the user who made the comment. Int is a signed 32-bit integer.
        threadId: Int # ID of the comment thread (optional). Int is a signed 32-bit integer.
        content: String! # Comment content. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the comment was created. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
        product: Product! # Product details. The Product object must be non-null.
        thread: Thread # Thread information (optional). The Thread object can be null.
      }

      type Report {
        id: Int! # Unique report ID. Int is a signed 32-bit integer.
        productId: Int! # ID of the reported product. Int is a signed 32-bit integer.
        userId: Int! # ID of the user who made the report. Int is a signed 32-bit integer.
        reason: String! # Reason for the report. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the report was created. DateTime is a custom scalar type.
        blockedUserId: Int # ID of the blocked user (optional). Int is a signed 32-bit integer.
        user: User! # User information. The User object must be non-null.
        product: Product! # Product details. The Product object must be non-null.
      }

      type Message {
        id: Int! # Unique message ID. Int is a signed 32-bit integer.
        senderId: Int! # ID of the message sender. Int is a signed 32-bit integer.
        receiverId: Int! # ID of the message receiver. Int is a signed 32-bit integer.
        content: String! # Message content. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the message was created. DateTime is a custom scalar type.
        sender: User! # Sender information. The User object must be non-null.
        receiver: User! # Receiver information. The User object must be non-null.
        reactions: [MessageReaction!]! # Reactions to the message. The list cannot be null, and each MessageReaction must also be non-null.
      }

      type MessageReaction {
        id: Int! # Unique reaction ID. Int is a signed 32-bit integer.
        messageId: Int! # ID of the associated message. Int is a signed 32-bit integer.
        userId: Int! # ID of the user who reacted. Int is a signed 32-bit integer.
        type: ReactionType! # Type of reaction (e.g., like, love). ReactionType is an enum.
        createdAt: DateTime! # Timestamp when the reaction was made. DateTime is a custom scalar type.
        message: Message! # Message details. The Message object must be non-null.
        user: User! # User information. The User object must be non-null.
      }

      type SearchHistory {
        id: Int! # Unique search history entry ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user. Int is a signed 32-bit integer.
        query: String! # Search query. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the search was made. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
      }

      type SavedSearch {
        id: Int! # Unique saved search ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user. Int is a signed 32-bit integer.
        query: String! # Search query. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the search was saved. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
      }

      type Wishlist {
        id: Int! # Unique wishlist entry ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user. Int is a signed 32-bit integer.
        productId: Int! # ID of the wished product. Int is a signed 32-bit integer.
        createdAt: DateTime! # Timestamp when added to wishlist. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
        product: Product! # Product details. The Product object must be non-null.
      }

      type Thread {
        id: Int! # Unique thread ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user who created the thread. Int is a signed 32-bit integer.
        title: String! # Thread title. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the thread was created. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
        comments: [Comment!]! # Comments in this thread. The list cannot be null, and each Comment must also be non-null.
      }

      type Post {
        id: Int! # Unique post ID. Int is a signed 32-bit integer.
        content: String! # Post content. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the post was created. DateTime is a custom scalar type.
        updatedAt: DateTime! # Timestamp when the post was updated. DateTime is a custom scalar type.
        userId: Int! # ID of the user who created the post. Int is a signed 32-bit integer.
        user: User! # User information. The User object must be non-null.
        reactions: [PostReaction!]! # Reactions to the post. The list cannot be null, and each PostReaction must also be non-null.
        engagementMetrics: [EngagementMetric!]! # Metrics tracking engagement. The list cannot be null, and each EngagementMetric must also be non-null.
      }

      type PostReaction {
        id: Int! # Unique reaction ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user who reacted. Int is a signed 32-bit integer.
        postId: Int! # ID of the associated post. Int is a signed 32-bit integer.
        type: ReactionType! # Type of reaction (e.g., like, love). ReactionType is an enum.
        createdAt: DateTime! # Timestamp when the reaction was made. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
        post: Post! # Post details. The Post object must be non-null.
      }

      type Poll {
        id: Int! # Unique poll ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user who created the poll. Int is a signed 32-bit integer.
        question: String! # Poll question. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the poll was created. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
        options: [PollOption!]! # Options for the poll. The list cannot be null, and each PollOption must also be non-null.
        votes: [PollVote!]! # Votes cast for the poll. The list cannot be null, and each PollVote must also be non-null.
      }

      type PollOption {
        id: Int! # Unique option ID. Int is a signed 32-bit integer.
        pollId: Int! # ID of the associated poll. Int is a signed 32-bit integer.
        content: String! # Option content. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the option was created. DateTime is a custom scalar type.
        poll: Poll! # Poll details. The Poll object must be non-null.
        votes: [PollVote!]! # Votes for this option. The list cannot be null, and each PollVote must also be non-null.
      }

      type PollVote {
        id: Int! # Unique vote ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user who voted. Int is a signed 32-bit integer.
        pollId: Int! # ID of the associated poll. Int is a signed 32-bit integer.
        optionId: Int! # ID of the selected option. Int is a signed 32-bit integer.
        createdAt: DateTime! # Timestamp when the vote was cast. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
        poll: Poll! # Poll details. The Poll object must be non-null.
        option: PollOption! # Selected option details. The PollOption object must be non-null.
      }

      type SupportTicket {
        id: Int! # Unique ticket ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user who created the ticket. Int is a signed 32-bit integer.
        subject: String! # Subject of the support ticket. String is a UTF-8 character sequence.
        message: String! # Message content. String is a UTF-8 character sequence.
        status: String! # Current status of the ticket. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the ticket was created. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
      }

      type Badge {
        id: Int! # Unique badge ID. Int is a signed 32-bit integer.
        name: String! # Badge name. String is a UTF-8 character sequence.
        description: String! # Badge description. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the badge was created. DateTime is a custom scalar type.
        userBadges: [UserBadge!]! # List of users who earned this badge. The list cannot be null, and each UserBadge must also be non-null.
      }

      type Review {
        id: Int! # Unique review ID. Int is a signed 32-bit integer.
        productId: Int! # ID of the reviewed product. Int is a signed 32-bit integer.
        userId: Int! # ID of the user who wrote the review. Int is a signed 32-bit integer.
        rating: Int! # Rating value. Int is a signed 32-bit integer.
        content: String! # Review content. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the review was created. DateTime is a custom scalar type.
        updatedAt: DateTime! # Timestamp when the review was last updated. DateTime is a custom scalar type.
        imageUrls: [String!]! # URLs of images associated with the review. The list cannot be null, and each URL must be a non-null string.
        product: Product! # Product information. The Product object must be non-null.
        user: User! # User information. The User object must be non-null.
      }

      type SearchFilter {
        id: Int! # Unique filter ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user. Int is a signed 32-bit integer.
        filters: JSON! # JSON object containing filter criteria.
        createdAt: DateTime! # Timestamp when the filter was created. DateTime is a custom scalar type.
        updatedAt: DateTime! # Timestamp when the filter was updated. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
      }

      type ProductRating {
        id: Int! # Unique rating ID. Int is a signed 32-bit integer.
        productId: Int! # ID of the rated product. Int is a signed 32-bit integer.
        userId: Int! # ID of the user who rated. Int is a signed 32-bit integer.
        rating: Int! # Rating value. Int is a signed 32-bit integer.
        createdAt: DateTime! # Timestamp when the rating was created. DateTime is a custom scalar type.
        product: Product! # Product information. The Product object must be non-null.
        user: User! # User information. The User object must be non-null.
      }

      type Language {
        id: Int! # Unique language ID. Int is a signed 32-bit integer.
        code: String! # Language code (e.g., "en"). String is a UTF-8 character sequence.
        name: String! # Language name. String is a UTF-8 character sequence.
        users: [User!]! # List of users who speak this language. The list cannot be null, and each User must also be non-null.
      }

      type UserPreference {
        id: Int! # Unique preference ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user. Int is a signed 32-bit integer.
        preferences: JSON! # JSON object containing user preferences.
        createdAt: DateTime! # Timestamp when preferences were created. DateTime is a custom scalar type.
        updatedAt: DateTime! # Timestamp when preferences were updated. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
      }

      type Tag {
        id: Int! # Unique ID for the tag. Int is a signed 32-bit integer.
        name: String! # Name of the tag. String is a UTF-8 character sequence.
        products: [ProductTag!]! # List of ProductTag relationships associated with the tag. This list cannot be null, and each ProductTag must also be non-null.
      }

      type ProductTag {
        id: Int! # Unique ID for the product-tag relationship. Int is a signed 32-bit integer.
        productId: Int! # Foreign key to Product. Int is a signed 32-bit integer.
        tagId: Int! # Foreign key to Tag. Int is a signed 32-bit integer.
        product: Product! # Associated Product object. Product must be non-null.
        tag: Tag! # Associated Tag object. Tag must be non-null.
      }

      type EngagementMetric {
        id: Int! # Unique metric ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user. Int is a signed 32-bit integer.
        productId: Int # ID of the engaged product (optional). Int is a signed 32-bit integer.
        postId: Int # ID of the engaged post (optional). Int is a signed 32-bit integer.
        actionType: String! # Type of engagement action (e.g., view, like). String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the action occurred. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
        product: Product # Product details (optional). The Product object can be null.
        post: Post # Post details (optional). The Post object can be null.
      }

      type ModerationReport {
        id: Int! # Unique report ID. Int is a signed 32-bit integer.
        reportedById: Int! # ID of the user who reported. Int is a signed 32-bit integer.
        targetId: Int! # ID of the reported user or content. Int is a signed 32-bit integer.
        reason: String! # Reason for the report. String is a UTF-8 character sequence.
        status: String! # Current status of the report. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when the report was created. DateTime is a custom scalar type.
        updatedAt: DateTime! # Timestamp when the report was last updated. DateTime is a custom scalar type.
        reportedBy: User! # User information. The User object must be non-null.
      }

      type ProductVariant {
        id: Int! # Unique variant ID. Int is a signed 32-bit integer.
        productId: Int! # ID of the associated product. Int is a signed 32-bit integer.
        size: String! # Size of the variant. String is a UTF-8 character sequence.
        color: String! # Color of the variant. String is a UTF-8 character sequence.
        inventories: [Inventory!]! # List of inventories for this variant. The list cannot be null, and each Inventory must also be non-null.
        product: Product! # Product details. The Product object must be non-null.
      }

      type Inventory {
        id: Int! # Unique inventory ID. Int is a signed 32-bit integer.
        variantId: Int! # ID of the associated product variant. Int is a signed 32-bit integer.
        quantity: Int! # Available quantity. Int is a signed 32-bit integer.
        createdAt: DateTime! # Timestamp when inventory was created. DateTime is a custom scalar type.
        updatedAt: DateTime! # Timestamp when inventory was last updated. DateTime is a custom scalar type.
        variant: ProductVariant! # Product variant details. The ProductVariant object must be non-null.
      }

      type Achievement {
        id: Int! # Unique achievement ID. Int is a signed 32-bit integer.
        name: String! # Name of the achievement. String is a UTF-8 character sequence.
        description: String! # Description of the achievement. String is a UTF-8 character sequence.
        criteria: JSON! # Criteria for earning the achievement.
        createdAt: DateTime! # Timestamp when the achievement was created. DateTime is a custom scalar type.
        userAchievements: [UserAchievement!]! # List of users who earned this achievement. The list cannot be null, and each UserAchievement must also be non-null.
      }

      type UserAchievement {
        id: Int! # Unique user achievement ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user who earned the achievement. Int is a signed 32-bit integer.
        achievementId: Int! # ID of the associated achievement. Int is a signed 32-bit integer.
        createdAt: DateTime! # Timestamp when the achievement was earned. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
        achievement: Achievement! # Achievement details. The Achievement object must be non-null.
      }

      type Leaderboard {
        id: Int! # Unique leaderboard entry ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user. Int is a signed 32-bit integer.
        score: Int! # User's score on the leaderboard. Int is a signed 32-bit integer.
        createdAt: DateTime! # Timestamp when the entry was created. DateTime is a custom scalar type.
        updatedAt: DateTime! # Timestamp when the entry was last updated. DateTime is a custom scalar type.
        user: User! # User information. The User object must be non-null.
      }

      type Bundle {
        id: Int! # Unique bundle ID. Int is a signed 32-bit integer.
        name: String! # Name of the bundle. String is a UTF-8 character sequence.
        description: String # Optional description of the bundle.
        price: Float! # Price of the bundle. Float is a double-precision floating-point value.
        createdAt: DateTime! # Timestamp when the bundle was created. DateTime is a custom scalar type.
        updatedAt: DateTime! # Timestamp when the bundle was last updated. DateTime is a custom scalar type.
        products: [BundleProduct!]! # List of products in the bundle. The list cannot be null, and each product must also be non-null.
      }

      type BundleProduct {
        id: Int! # Unique bundle product ID. Int is a signed 32-bit integer.
        bundleId: Int! # ID of the associated bundle. Int is a signed 32-bit integer.
        productId: Int! # ID of the product. Int is a signed 32-bit integer.
        quantity: Int! # Quantity of the product in the bundle. Int is a signed 32-bit integer.
        bundle: Bundle! # Bundle details. The Bundle object must be non-null.
        product: Product! # Product details. The Product object must be non-null.
      }

      type Query {
        # User Retrieval
        getUserById(id: Int!): User! # Retrieve a specific user by their unique ID.
        getAllUsers: [User!]! # Retrieve a list of all users in the system.
        getRecentUsers(limit: Int!): [User!]! # Fetch a limited number of recent users.
        getUsersByRegistrationDateRange(
          startDate: DateTime!
          endDate: DateTime!
        ): [User!]! # Fetch users registered within a date range.
        # User Favorites
        getUserFavorites(userId: Int!): [Product!]! # Fetch all products favorited by a specific user.
        getUserViewedProducts(userId: Int!): [Product!]! # Fetch all products viewed by a specific user.
        # User Search History
        getUserSearchHistory(userId: Int!): [SearchHistory!]! # Retrieve the search history of a specific user.
        # User Messages
        getUserSentMessages(userId: Int!): [Message!]! # Fetch all messages sent by a specific user.
        getUserReceivedMessages(userId: Int!): [Message!]! # Fetch all messages received by a specific user.
        # User Statistics
        getUserProductCount(userId: Int!): Int! # Fetch the total number of products listed by a specific user.
        getUserFollowerCount(userId: Int!): Int! # Fetch the total number of followers for a specific user.
        getUserFollowingCount(userId: Int!): Int! # Fetch the total number of users a specific user is following.
        getUserActivityCount(userId: Int!): Int! # Fetch user activity statistics.
        # User Relationships
        getUserFollowers(userId: Int!): [User!]! # Fetch all followers of a specific user.
        getUserFollowing(userId: Int!): [User!]! # Fetch all users that a specific user is following.
        # User Roles
        getAdminUsers: [User!]! # Fetches all users with the admin role.
        getModeratorUsers: [User!]! # Fetches all users with the moderator role.
        getRegularUsers: [User!]! # Fetches all users with the regular user role.
        getUserRoles(userId: Int!): [Role!]! # Fetches the role of a specific user.
        getUsersByRole(role: Role!): [User!]! # Fetches all users with the specified role.
        getAllRoles: [Role!]! # Get all available roles.
        # User Activity and Status
        getActiveUsers: [User!]! # Fetches all active users.
        getUserRoleStatistics: [[String]]! # Fetches user role statistics as an array of arrays.
        # User Achievements and Badges
        getUserBadges(userId: Int!): [UserBadge!]! # Fetches all badges earned by a specific user.
        getUserAchievements(userId: Int!): [UserAchievement!]! # Fetches all achievements earned by a specific user.
        # Notifications
        getUserNotifications(userId: Int!): [Notification!]! # Fetches all notifications for a specific user.
        getUserUnreadNotifications(userId: Int!): [Notification!]! # Fetches all unread notifications for a specific user.
        # Languages and Profile Info
        getUserLanguage(userId: Int!): [Language!]! # Fetches all languages spoken by a specific user.
        getUserProfileInfo(userId: Int!): User! # Fetches the user's bio and profile information.
        # User Ratings
        getUserRatings(userId: Int!): [UserRating!]! # Fetches all ratings associated with a specific user.
        getUserRatingsGiven(userId: Int!): [UserRating!]! # Fetches ratings given by a specific user.
        getUserRatingsReceived(userId: Int!): [UserRating!]! # Fetches ratings received by a specific user.
        # User Activity Log
        getUserActivityLog(userId: Int!): [UserActivity!]! # Fetches the user's activity log.
        getUserProducts(userId: Int!): [Product!]! # Fetches all products listed by a specific user.
        getUserReviews(userId: Int!): [Review!]! # Fetches all reviews written by a specific user.
        getUserSavedSearches(userId: Int!): [SavedSearch!]! # Fetches all saved searches by a specific user.
      }

      # Input type for creating a new user
      input CreateUserInput {
        phrase: String # Optional phrase field for role assignment
        email: String! # Required email field
        username: String! # Required username field
        password: String! # Required password field
      }

      type Mutation {
        createUser(input: CreateUserInput!): User! # Mutation to create a user
      }
    `,
    resolvers: {
      Date: dateScalar,
      DateTime: dateTimeScalar,
      JSON: GraphQLJSON,
      Query: {
        // Fetches a list of all users from the database.
        // SELECT * FROM users;
        getAllUsers: async () => {
          // SELECT * FROM users;
          return await prisma.user.findMany();
        },
        // Fetches user details for the specified user ID.
        /* SELECT * FROM users 
           WHERE id = userId;
        */
        getUserById: async (_, { userId }) => {
          // SELECT * FROM users
          return await prisma.user.findUnique({
            // WHERE id = userId
            where: { id: userId },
          });
        },
        // Fetches the most recently registered users.
        /* SELECT * FROM users 
        ORDER BY createdAt DESC 
        LIMIT limit;
        */
        getRecentUsers: async (_, { limit }) => {
          // SELECT * FROM users;
          return await prisma.user.findMany({
            // ORDER BY createdAt, newest first
            orderBy: { createdAt: "desc" },
            // LIMIT limit
            take: limit,
          });
        },
        // Fetches users who registered within a specific date range.
        /* SELECT * FROM users 
        WHERE createdAt BETWEEN startDate AND endDate;
        */
        getUsersByRegistrationDateRange: async (_, { startDate, endDate }) => {
          // SELECT * FROM users;
          return await prisma.user.findMany({
            // WHERE createdAt BETWEEN startDate AND endDate
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          });
        },
        // Fetches all products favorited by a specific user.
        /* SELECT * FROM products 
        WHERE id IN (SELECT productId FROM favorites WHERE userId = userId);
      */
        getUserFavorites: async (_, { userId }) => {
          // SELECT * FROM products;
          return await prisma.product.findMany({
            // WHERE favoritedBy contains userId;
            where: { favoritedBy: { some: { id: userId } } },
          });
        },
        // Fetches all products viewed by a specific user.
        /* SELECT * FROM products 
        WHERE viewedBy IN (SELECT viewedBy FROM product WHERE userId = userId);
      */
        getUserViewedProducts: async (_, { userId }) => {
          // SELECT * FROM products;
          return await prisma.product.findMany({
            // WHERE viewedBy contains userId
            where: { viewedBy: { some: { id: userId } } },
          });
        },
        // Fetches the search history of a specific user.
        /* SELECT * FROM searchHistory 
        WHERE userId = userId;
        */
        getUserSearchHistory: async (_, { userId }) => {
          // SELECT * FROM searchHistory;
          return await prisma.searchHistory.findMany({
            // WHERE userId = userId
            where: { userId },
            // Include user information for each search history entry
            include: { user: true },
          });
        },
        // Fetches all messages sent by a specific user.
        /* SELECT * FROM messages 
        WHERE senderId = userId; 
        */
        getUserSentMessages: async (_, { userId }) => {
          // SELECT * FROM messages;
          return await prisma.message.findMany({
            // WHERE senderId = userId
            where: { senderId: userId },
          });
        },
        // Fetches all messages received by a specific user.
        /* SELECT * FROM messages 
        WHERE receiverId = userId
        */
        getUserReceivedMessages: async (_, { userId }) => {
          // SELECT * FROM messages;
          return await prisma.message.findMany({
            // WHERE receiverId = userId
            where: { receiverId: userId },
          });
        },
        // Fetches the total number of products listed by a specific user.
        /* SELECT COUNT(*) FROM products 
        WHERE sellerId = userId;
        */
        getUserProductCount: async (_, { userId }) => {
          // SELECT COUNT(*) FROM products;
          return await prisma.product.count({
            // WHERE sellerId = userId
            where: { sellerId: userId },
          });
        },
        // Fetches the total number of followers for a specific user.
        /* SELECT COUNT(*) FROM userFollows 
        WHERE followedId = userId;
        */
        getUserFollowerCount: async (_, { userId }) => {
          // SELECT COUNT(*) FROM userFollows;
          return await prisma.userFollow.count({
            // WHERE followedId = userId
            where: { followedId: userId },
          });
        },
        // Fetches the total number of users a specific user is following.
        /* SELECT COUNT(*) FROM userFollows 
        WHERE followerId = userId;
        */
        getUserFollowingCount: async (_, { userId }) => {
          // SELECT COUNT(*) FROM userFollows;
          return await prisma.userFollow.count({
            // WHERE followerId = userId
            where: { followerId: userId },
          });
        },
        // Fetches user activity statistics (like total activities logged).
        /* SELECT COUNT(*) FROM userActivity 
        WHERE userId = userId;
        */
        getUserActivityCount: async (_, { userId }) => {
          // SELECT COUNT(*) FROM userActivity;
          return await prisma.userActivity.count({
            // WHERE userId = userId
            where: { userId },
          });
        },
        // Fetches all followers of a specific user.
        /* SELECT * FROM users 
        WHERE id IN (SELECT followerId FROM userFollows WHERE followedId = userId);
        */
        getUserFollowers: async (_, { userId }) => {
          // SELECT * FROM users;
          return await prisma.userFollow.findMany({
            // WHERE followedId = userId
            where: { followedId: userId },
            include: { follower: true }, // Include follower details
          });
        },
        // Fetches all users that a specific user is following.
        /* SELECT * FROM users 
        WHERE id IN (SELECT followedId FROM userFollows WHERE followerId = userId);
        */
        getUserFollowing: async (_, { userId }) => {
          // SELECT * FROM users;
          return await prisma.userFollow.findMany({
            // WHERE followerId = userId
            where: { followerId: userId },
            include: { followed: true }, // Include followed user details
          });
        },
        // Fetches all users with the admin role.
        /* SQL: SELECT * FROM users 
        WHERE role = 'ADMIN';
        */
        getAdminUsers: async () => {
          // SELECT * FROM users;
          return await prisma.user.findMany({
            // WHERE role = 'ADMIN'
            where: { role: "ADMIN" },
          });
        },
        // Fetches all users with the moderator role.
        /* SQL: SELECT * FROM users 
        WHERE role = 'MODERATOR';
        */
        getModeratorUsers: async () => {
          // SELECT * FROM users;
          return await prisma.user.findMany({
            // WHERE role = 'MODERATOR'
            where: { role: "MODERATOR" },
          });
        },
        // Fetches all users with the regular user role.
        /* SELECT * FROM users 
        WHERE role = 'USER';
        */
        getRegularUsers: async () => {
          // SELECT * FROM users;
          return await prisma.user.findMany({
            // WHERE role = 'USER'
            where: { role: "USER" },
          });
        },
        // Fetches the role of a specific user.
        /* SELECT role FROM users 
        WHERE id = userId;
        */
        getUserRoles: async (_, { userId }) => {
          // SELECT role FROM users;
          const user = await prisma.user.findUnique({
            // WHERE id = userId
            where: { id: userId },
            select: { role: true }, // Directly fetch the user's role
          });
          return user ? [user.role] : []; // Return the role in an array format
        },
        // Fetches all users with the specified role.
        /* SELECT * FROM users 
        WHERE role = :role;
        */
        getUsersByRole: async (_, { role }) => {
          // SELECT * FROM users;
          return await prisma.user.findMany({
            // WHERE role = :role
            where: { role: role }, // Filter users by the specified role
          });
        },
        // Fetches all active users (assumes an 'active' field exists).
        /* SELECT * FROM users 
        WHERE lastActive >= NOW() - INTERVAL '30 days';
        */
        getActiveUsers: async () => {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // Calculate date 30 days ago
          // SELECT * FROM users;
          return await prisma.user.findMany({
            // WHERE lastActive >= NOW() - INTERVAL '30 days'
            where: {
              lastActive: {
                gte: thirtyDaysAgo, // Filter for users who have been active in the last 30 days
              },
            },
          });
        },
        // Fetches user role statistics.
        /* SELECT role, COUNT(*) as userCount FROM users 
        GROUP BY role;
        */
        getUserRoleStatistics: async () => {
          return await prisma.user.groupBy({
            by: ["role"], // Group by user role
            _count: {
              role: true, // Count users per role
            },
          });
        },
        // Fetches all badges earned by a specific user.
        /* SELECT * FROM userBadges 
        WHERE userId = userId;
        */
        getUserBadges: async (_, { userId }) => {
          // Query the userBadge records
          return await prisma.userBadge.findMany({
            where: { userId }, // Filter by userId
            include: { badge: true }, // Include details of each badge
          });
        },
        // Fetches all achievements earned by a specific user.
        /* SELECT * FROM userAchievements 
        WHERE userId = userId;
        */
        getUserAchievements: async (_, { userId }) => {
          return await prisma.userAchievement.findMany({
            where: { userId }, // Filter by userId
            include: { achievement: true }, // Include achievement details
          });
        },

        // Fetches all notifications for a specific user.
        /* SELECT * FROM notifications 
        WHERE userId = userId;
        */
        getUserNotifications: async (_, { userId }) => {
          // SELECT * FROM notifications;
          return await prisma.notification.findMany({
            // WHERE userId = userId
            where: { userId },
          });
        },
        // Fetches all notifications that are unread for a specific user.
        /* SELECT * FROM notifications 
        WHERE userId = userId AND read = false;
        */
        getUserUnreadNotifications: async (_, { userId }) => {
          // SELECT * FROM notifications;
          return await prisma.notification.findMany({
            // WHERE userId = userId AND read = false
            where: { userId, read: false },
          });
        },
        // Fetches all languages spoken by a specific user.
        /* SELECT * FROM languages 
        WHERE userId = userId AND active = true;
        */
        getUserLanguage: async (_, { userId }) => {
          // SELECT * FROM languages;
          return await prisma.user.findUnique({
            // WHERE userId = userId AND language = true
            where: {
              id: userId, // Find the user by their ID
            },
            include: {
              language: true, // Include the language associated with the user
            },
          });
        },
        // Fetches the user's bio and profile information.
        /* SELECT bio, profilePicture FROM users 
        WHERE id = userId;
        */
        getUserProfileInfo: async (_, { userId }) => {
          // SELECT bio, username, profilePicture FROM users;
          return await prisma.user.findUnique({
            // WHERE id = userId
            where: { id: userId },
            select: {
              bio: true, // Include bio
              username: true, // Include username
              profilePicture: true, // Include profile picture
            },
          });
        },
        // Fetches all ratings associated with a specific user.
        /* SELECT * FROM userRatings 
        WHERE raterId = userId OR ratedId = userId;
        */
        getUserRatings: async (_, { userId }) => {
          // SELECT * FROM userRatings;
          return await prisma.userRating.findMany({
            // WHERE raterId = userId OR ratedId = userId
            where: {
              OR: [
                { raterId: userId }, // Ratings given by the user
                { ratedId: userId }, // Ratings received by the user
              ],
            },
          });
        },
        // Fetches ratings given by a specific user.
        /* SQL: SELECT * FROM userRatings 
        WHERE raterId = userId;
        */
        getUserRatingsGiven: async (_, { userId }) => {
          // SELECT * FROM userRatings;
          return await prisma.userRating.findMany({
            // WHERE raterId = userId
            where: { raterId: userId },
          });
        },
        // Fetches ratings received by a specific user.
        /* SELECT * FROM userRatings 
        WHERE ratedId = userId;
        */
        getUserRatingsReceived: async (_, { userId }) => {
          // SELECT * FROM userRating;
          return await prisma.userRating.findMany({
            // WHERE ratedId = userId
            where: { ratedId: userId },
          });
        },
        // Fetches the user's activity log. g
        /* SELECT * FROM userActivity 
        WHERE userId = userId;
        */
        getUserActivityLog: async (_, { userId }) => {
          // SELECT * FROM userActivity;
          return await prisma.userActivity.findMany({
            // WHERE userId = userId
            where: { userId },
          });
        },
        // Fetches all products listed by a specific user.
        /* SELECT * FROM products 
        WHERE sellerId = userId;
        */
        getUserProducts: async (_, { userId }) => {
          // SELECT * FROM products;
          return await prisma.product.findMany({
            // WHERE sellerId = userId;
            where: { sellerId: userId },
          });
        },
        // Fetches all reviews written by a specific user.
        /* SELECT * FROM reviews 
        WHERE userId = userId;
        */
        getUserReviews: async (_, { userId }) => {
          // SELECT * FROM reviews;
          return await prisma.review.findMany({
            // WHERE userId = userId
            where: { userId },
          });
        },
        // Fetches all saved searches by a specific user.
        /* SELECT * FROM savedSearches 
        WHERE userId = userId;
        */
        getUserSavedSearches: async (_, { userId }) => {
          // SELECT * FROM savedSearches;
          return await prisma.savedSearch.findMany({
            // WHERE userId = userId
            where: { userId },
          });
        },
      },
      Mutation: {
        createUser: async (_, { input }) => {
          // Destructure the input to get phrase, email, username, and password
          const { phrase, email, username, password } = input;

          // Check if a phrase has been provided for admin or moderator access
          let role: Role = Role.USER; // Default role is USER

          if (phrase) {
            // Compare the provided phrase against the environment variable for ADMIN
            if (phrase === process.env.ADMIN_PHRASE) {
              role = Role.ADMIN; // Set role to ADMIN if phrase matches
            }
            // Compare the provided phrase against the environment variable for MODERATOR
            else if (phrase === process.env.MODERATOR_PHRASE) {
              role = Role.MODERATOR; // Set role to MODERATOR if phrase matches
            }
            // If the phrase doesn't match either, throw an error
            else {
              throw new Error("Invalid phrase for admin or moderator role.");
            }
          }

          // Ensure email, username, and password are provided; if not, throw an error
          if (!email || !username || !password) {
            throw new Error("Email, username, and password are required.");
          }

          try {
            // Hash the password using bcrypt
            const hashedPassword = await bcrypt.hash(password, 10);

            /*
              INSERT INTO User (email, password, role, username) 
              VALUES ('email_value', 'hashed_password', 'role_value', 'username_value');
            */
            const newUser = await prisma.user.create({
              data: {
                email,
                password: hashedPassword,
                role,
                username,
              },
            });

            // Return the newly created user object
            return newUser;
          } catch (error) {
            // Handle any errors that occur during user creation
            console.error(error);
            throw new Error("Failed to create user. Please try again.");
          }
        },
      },
    },
  }),

  // While using Next.js file convention for routing, we need to configure Yoga to use the correct endpoint
  graphqlEndpoint: "/api/graphql",

  // Yoga needs to know how to create a valid Next response
  fetchAPI: { Response },
});

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as OPTIONS,
};
