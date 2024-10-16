import { createSchema, createYoga } from "graphql-yoga";
import { GraphQLScalarType, Kind } from "graphql";
import GraphQLJSON from "graphql-type-json";
import { getSentiment } from "@/app/lib/getSentiment";
import { PrismaClient, RaffleResult, RaffleType } from "@prisma/client";
const prisma = new PrismaClient();

interface ConditionInput {
  field: string;
  value: string;
}

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

      // Enum RaffleResult indicates the outcome of a raffle entry
      enum RaffleResult {
        WON    // User won the raffle
        LOST   // User lost the raffle
        PENDING // Raffle outcome is still pending
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

      # Enum for reasons a product might be flagged.
      enum ProductFlagReason {
        FAKE # Product is counterfeit.
        NOT_AS_DESCRIBED # Product does not match the description provided.
        INAPPROPRIATE_CONTENT # Content is offensive or inappropriate.
        SPAM # Listing is considered spam.
        COPYRIGHT_INFRINGEMENT # Product violates copyright laws.
        IMPERSONATION # Seller falsely represents a brand.
        ALTERED_IMAGES # Product images have been digitally altered.
        COUNTERFEIT_LABELS # Product displays fake branding.
        SUSPICIOUSLY_LOW_PRICE # Unusually low price raises suspicion.
        BAD_REVIEWS # Multiple negative reviews about authenticity.
        UNVERIFIABLE_CLAIMS # Claims made by the seller are unverifiable.
        LACK_OF_AUTHENTICITY # Seller cannot provide proof of authenticity.
        UNAUTHORIZED_RESELLER # Seller is not an authorized reseller for the brand.
        FAKE_REVIEWS # Product has numerous fabricated reviews.
        LIMITED_SUPPLY # Misleading claims of being in short supply.
        EXCESSIVE_RETURNS # High return rate due to counterfeiting.
        DISCONTINUED_MODEL # Selling of a discontinued model.
        MISMATCHED_SERIAL_NUMBERS # Serial numbers do not match expected values.
        INCONSISTENT_BRANDING # Branding or packaging inconsistencies.
        LACK_OF_WARRANTY # No valid warranty provided.
        UNRELIABLE_SELLER_HISTORY # Seller has a history of complaints.
        REPRODUCTION_LABELS # Being sold as original when it's a reproduction.
        UNAUTHENTIC_MATERIALS # Made from materials that do not match the description.
        UNRELIABLE_SIZE_CHART # Size chart does not match actual sizing.
        INACCURATE_COLOR_REPRESENTATION # Color differs from images shown.
        DISREPUTED_BRAND # Brand has a history of authenticity complaints.
        UNAUTHORIZED_CUSTOMIZATION # Customized in a way not sanctioned by the brand.
        SEASONALITY_ISSUES # Sold out of season, raising authenticity suspicions.
        MISSING_CERTIFICATION # Should have certifications but does not provide proof.
        BULK_RESALE_SCAM # Part of a bulk resale scam.
        FAKE_OR_MISLEADING_ENDORSEMENTS # Claims endorsements that are not genuine.
        COMPROMISED_PACKAGING # Packaging shows signs of tampering.
      }

      # Enum for the status of a product flag.
      enum ProductFlagStatus {
        REPORTED # Product has been flagged and is pending review.
        UNDER_REVIEW # Product is currently being reviewed by an admin or moderator.
        RESOLVED # Flag has been reviewed and the issue has been addressed.
        IGNORED # Flag has been reviewed but deemed not a valid issue.
        REMOVED # Product has been removed from the marketplace.
      }

      input ConditionInput {
        field: String!
        value: Condition!
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

      type Feedback {
        id: Int! # Unique feedback ID. Int is a signed 32-bit integer.
        userId: Int! # ID of the user providing feedback. Int is a signed 32-bit integer.
        message: String! # Feedback message content. String is a UTF-8 character sequence.
        createdAt: DateTime! # Timestamp when feedback was submitted. DateTime is a custom scalar type.
        user: User # User who provided the feedback. The User object can be null.
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
        id: Int! # Unique identifier for the product (Primary Key).
        title: String! # Title of the product.
        description: String! # Detailed description of the product.
        cost: Float # Optional cost of the product.
        price: Float! # Price of the product.
        condition: Condition! # Condition of the product (e.g., new, used).
        status: ProductStatus! # Status of the product indicating its availability.
        createdAt: DateTime! # Timestamp for when the product was created.
        soldAt: DateTime # Timestamp for when the product was sold (optional).
        releaseDate: DateTime # Release date of the product (optional).
        sellerId: Int! # ID of the seller (Foreign Key).
        hasRaffle: Boolean! # Indicates if the product has a raffle.
        countryId: Int # ID of the country (optional, Foreign Key).
        brandId: Int # ID of the brand (optional, Foreign Key).
        seller: User! # Seller information (One-to-Many relationship).
        favoritedBy: [User!]! # Users who favorited the product (Many-to-Many relationship).
        viewedBy: [User!]! # Users who viewed the product (Many-to-Many relationship).
        priceHistory: [PriceHistory!]! # One product can have many historical price records (One-to-Many relationship).
        raffles: [Raffle!]! # One product can have many raffles (One-to-Many relationship).
        media: [Media!]! # One product can have many media entries (One-to-Many relationship).
        country: Country # One product may be linked to one country (optional).
        brand: Brand # One product may be linked to one brand (optional).
        ratings: [ProductRating!]! # One product can have many ratings (One-to-Many relationship).
        reports: [Report!]! # One product can have many reports (One-to-Many relationship).
        comments: [Comment!]! # One product can have many comments (One-to-Many relationship).
        wishlistedBy: [Wishlist!]! # One product can be wishlisted by many users (One-to-Many relationship).
        reviews: [Review!]! # One product can have many reviews (One-to-Many relationship).
        engagementMetrics: [EngagementMetric!]! # One product can have many engagement metrics (One-to-Many relationship).
        tags: [ProductTag!]! # One product can have many tags (Many-to-Many relationship).
        variants: [ProductVariant!]! # One product can have many variants (One-to-Many relationship).
        bundles: [ProductBundle!]! # One product can be included in many bundles (One-to-Many relationship).
        quantity: Int! # Available quantity of the product.
        stock: Int # Stock level of the product (optional).
        sales: [Sale!]! # One product can have many sales (One-to-Many relationship).
        purchases: [Purchase!]! # One product can be included in many purchases (One-to-Many relationship).
        flags: [ProductFlag!]! # One product can have many flags (One-to-Many relationship).
      }

      type Purchase {
        id: Int! # Unique identifier for the purchase (Primary Key).
        saleId: Int! # ID of the associated sale (Foreign Key).
        userId: Int! # ID of the user making the purchase (Foreign Key).
        productId: Int! # ID of the product purchased (Foreign Key).
        createdAt: DateTime! # Timestamp of the purchase.
        soldAt: DateTime # Timestamp of when the item was sold (same as sale time).
        sale: Sale! # A purchase is linked to one sale (Many-to-One relationship).
        user: User! # A purchase is made by one user (Many-to-One relationship).
        product: Product! # A purchase is for one product (Many-to-One relationship).
      }

      type Sale {
        id: Int! # Unique identifier for the sale (Primary Key).
        productId: Int! # ID of the product sold (Foreign Key).
        userId: Int! # ID of the user making the sale (Foreign Key).
        quantity: Int! # Quantity sold.
        totalPrice: Float! # Total price of the sale.
        soldAt: DateTime! # Timestamp of the sale.
        product: Product! # A sale is linked to one product (Many-to-One relationship).
        user: User! # A sale is made by one user (Many-to-One relationship).
        purchases: [Purchase!]! # One sale can be linked to multiple purchases (One-to-Many relationship).
      }

      type ProductFlag {
        id: ID!
        productId: Int!
        reason: ProductFlagReason!
        status: ProductFlagStatus!
        createdAt: String!
        createdById: Int!
        createdBy: User!
        product: Product!
      }

      type Category {
        id: Int! # Unique ID for the category. Int is a signed 32-bit integer.
        name: String! # The name of the category (e.g., Electronics, Clothing).
        description: String # A brief description of the category (optional). String is a UTF-8 character sequence.
        products: [ProductCategory!]! # Many-to-many relationship: The products associated with this category. The list cannot be null, and each ProductCategory must also be non-null.
      }

      type ProductCategory {
        productId: Int! # Foreign key to Product. Int is a signed 32-bit integer.
        categoryId: Int! # Foreign key to Category. Int is a signed 32-bit integer.
        product: Product! # The product associated with this category. The Product object must be non-null.
        category: Category! # The category associated with this product. The Category object must be non-null.
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
        result: RaffleResult! # Outcome of the raffle entry (WON, LOST, PENDING)
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
        # User Retrieval Queries
        # Fetch a specific user by their unique ID.
        getUserById(id: Int!): User! 
    
        # Fetch a list of all users in the system.
        getAllUsers: [User!]! 
    
        # Fetch a limited number of recent users.
        getRecentUsers(limit: Int!): [User!]! 
    
        # Fetch users registered within a date range.
        getUsersByRegistrationDateRange(startDate: DateTime!, endDate: DateTime!): [User!]! 
    
        # User Favorites Queries
        # Fetch all products favorited by a specific user.
        getUserFavorites(userId: Int!): [Product!]! 
    
        # Fetch all products viewed by a specific user.
        getUserViewedProducts(userId: Int!): [Product!]! 
    
        # User Search History Queries
        # Fetch the search history of a specific user.
        getUserSearchHistory(userId: Int!): [SearchHistory!]! 
    
        # User Review Queries
        # Fetch all products with high reviews.
        getProductsWithHighReviews: [Product!]!
        getProductsWithLowReviews: [Product!]!
        # Fetches all reviews written by a specific user.
        getUserReviews(userId: Int!): [Review!]! 

        # User Messages Queries
        # Fetch all messages sent by a specific user.
        getUserSentMessages(userId: Int!): [Message!]! 
    
        # Fetch all messages received by a specific user.
        getUserReceivedMessages(userId: Int!): [Message!]! 
    
        # User Statistics Queries
        # Fetch the total number of products listed by a specific user.
        getUserProductCount(userId: Int!): Int! 
    
        # Fetch the total number of followers for a specific user.
        getUserFollowerCount(userId: Int!): Int! 
    
        # Fetch the total number of users a specific user is following.
        getUserFollowingCount(userId: Int!): Int! 
    
        # Fetch user activity statistics.
        getUserActivityCount(userId: Int!): Int! 
    
        # User Relationships Queries
        # Fetch all followers of a specific user.
        getUserFollowers(userId: Int!): [User!]! 
    
        # Fetch all users that a specific user is following.
        getUserFollowing(userId: Int!): [User!]! 
    
        # User Role Queries
        # Fetches all users with the admin role.
        getAdminUsers: [User!]! 
    
        # Fetches all users with the moderator role.
        getModeratorUsers: [User!]! 
    
        # Fetches all users with the regular user role.
        getRegularUsers: [User!]! 
    
        # Fetches the role of a specific user.
        getUserRoles(userId: Int!): [Role!]! 
    
        # Fetches all users with the specified role.
        getUsersByRole(role: Role!): [User!]! 
    
        # Get all available roles.
        getAllRoles: [Role!]! 
    
        # User Activity and Status Queries
        # Fetches all active users.
        getActiveUsers: [User!]! 
    
        # Fetches user role statistics as an array of arrays.
        getUserRoleStatistics: [[String]]! 
    
        # User Achievements and Badges Queries
        # Fetches all badges earned by a specific user.
        getUserBadges(userId: Int!): [UserBadge!]! 
    
        # Fetches all achievements earned by a specific user.
        getUserAchievements(userId: Int!): [UserAchievement!]! 
    
        # Notifications Queries
        # Fetches all notifications for a specific user.
        getUserNotifications(userId: Int!): [Notification!]! 
    
        # Fetches all unread notifications for a specific user.
        getUserUnreadNotifications(userId: Int!): [Notification!]! 
    
        # Languages and Profile Info Queries
        # Fetches all languages spoken by a specific user.
        getUserLanguage(userId: Int!): [Language!]! 
    
        # Fetches the user's bio and profile information.
        getUserProfileInfo(userId: Int!): User! 
    
        # User Ratings Queries
        # Fetches all ratings associated with a specific user.
        getUserRatings(userId: Int!): [UserRating!]! 
    
        # Fetches ratings given by a specific user.
        getUserRatingsGiven(userId: Int!): [UserRating!]! 
    
        # Fetches ratings received by a specific user.
        getUserRatingsReceived(userId: Int!): [UserRating!]! 
    
        # User Activity Log Queries
        # Fetches the user's activity log.
        getUserActivityLog(userId: Int!): [UserActivity!]! 
    
        # Fetches all saved searches by a specific user.
        getUserSavedSearches(userId: Int!): [SavedSearch!]! 
    
        # Products Queries
       
        # Fetches a list of all products in the system.
        getAllProducts: [Product!]! 
       
        # Fetches a specific product by its unique ID.
        getProductById(productId: Int!): Product 
       
        # Fetches all products listed by a specific user.
        getUserProducts(userId: Int!): [Product!]! 
    
        # Fetch products listed by a specific seller.
        getProductsBySeller(sellerId: Int!): [Product!]! 
    
        # Fetch products based on their condition.
        getProductsByCondition(conditionType: String!): [Product!]! 
    
        # Fetch products from a specific brand.
        getProductsByBrand(brandId: Int!): [Product!]! 
    
        # Fetch a limited number of recent products.
        getRecentProducts(limit: Int!): [Product!]! 
    
        # Fetch products from a specific category.
        getProductsByCategory(categoryId: Int!): [Product!]! 
    
        # Fetch products within a given price range.
        getProductsByPriceRange(minPrice: Float!, maxPrice: Float!): [Product!]! 
    
        # Fetch products listed in a specific country.
        getProductsByCountry(countryId: Int!): [Product!]! 
    
        # Fetch products favorited by a specific user.
        getFavoritedProducts(userId: Int!): [Product!]! 
    
        # Fetch products associated with a specific tag.
        getProductsByTag(tagId: Int!): [Product!]! 

        # Fetch products associated with multiple tags.
        getProductsByMultipleTags(tagIds: Int!): [Product!]! 
    
        # Fetch the most viewed products, limited by count.
        getMostViewedProducts(limit: Int!): [Product!]! 
    
        # Fetch products that are in stock.
        getInStockProducts: [Product!]! 
    
        # Fetch products with ratings above a specified threshold.
        getProductsByMinRating(minRating: Float!): [Product!]! 
    
        # Fetch products saved to a user's wishlist.
        getWishlistProducts(userId: Int!): [Product!]! 
    
        # Fetch products sorted by price.
        getProductsSortedByPrice(order: String!, limit: Int!): [Product!]! 
    
        # Fetch recent products from a specific seller.
        getRecentProductsBySeller(sellerId: Int!, limit: Int!): [Product!]! 
    
        # Fetch products within a specific bundle.
        getProductsByBundle(bundleId: Int!): [Product!]! 
    
        # Fetch products released on a specific date.
        getProductsByReleaseDate(releaseDate: DateTime!): [Product!]! 
    
        # Fetch the top sellers by product count.
        getTopSellers: [User!]! 
    
        # Fetch the most sold products.
        getTopSoldProducts: [Product!]! 
    
        # Fetch the total sales volume.
        getTotalSalesVolume: Float! 
    
        # Fetch the total number of products sold.
        getTotalSalesCount: Int! 
    
        # Fetch the most favorited products.
        getMostFavoritedProducts(limit: Int!): [Product!]! 
    
        # Fetch the most reviewed products.
        getMostReviewedProducts(limit: Int!): [Product!]! 
    
        # Fetch products that are low on stock.
        getLowStockProducts: [Product!]! 
    
        # Fetch products with their price history.
        getStockMovement: [Product!]! 
    
        # Fetch products that are low in stock based on a threshold.
        getLowStockAlerts(threshold: Int!): [Product!]! 
    
        # Fetch products based on their stock level.
        getProductsByStockLevel(stockLevel: String!): [Product!]! 
    
        # Fetch products based on multiple conditions.
        getProductsByMultipleConditions(conditions: [ConditionInput!]!): [Product!]! 
    
        # Fetch products by minimum rating count.
        getProductsByRatingCount(minRatingCount: Int!): [Product] 
    
        # Fetch products by seller's total sales.
        getProductsBySellerTotalSales(minSales: Int!): [Product] 
    
        # Fetch all purchases made by a specific user.
        getUserPurchaseHistory(userId: ID!): [Purchase] 
    
        # Fetch all sales made by a specific user.
        getUserSalesHistory(userId: ID!): [Sale] 
    
        # Fetch products by profit margin.
        getProductsByProfitMargin(margin: Float!): [Product] 
    
        # Fetch products based on flag count and status.
        getFlaggedProducts(minFlagCount: Int!, flagReason: String, flagStatus: String): [Product] 
    
        # Fetch the most listed products, limited by count.
        getMostListedProducts(limit: Int!): [Product!]! 
    
        # Fetch recently added products, limited by count.
        getRecentlyAddedProducts(limit: Int!): [Product!]! 
    
        # Fetch products by flag status.
        getProductsByFlagStatus(flagStatus: String!): [Product!]! 
    
        # Fetch ratings for a specific product.
        getProductRatings(productId: ID!): [ProductRating] 
    
        # Fetch total sales for a specific product.
        getTotalSalesForProduct(productId: ID!): Float 
    
        # Fetch sales trends for a specific product.
        getSalesTrends(productId: ID!, startDate: String!, endDate: String!): [Sale] 
    
        # Fetch products with the most feedback.
        getProductsWithMostFeedback(limit: Int!): [Product] 
    
        # Fetch products based on specific user feedback.
        getProductsBasedOnFeedback(userId: ID!): [Product] 
    
        # Fetch recently sold products, limited by count.
        getRecentlySoldProducts(limit: Int!): [Sale] 
    
        # Fetch the most profitable products.
        getMostProfitableProducts(limit: Int!): [Product] 
    
        # Fetch sales data for a specific user.
        getUserSalesData(userId: ID!): [Sale] 
    
        # Fetch stock levels for a specific product.
        getStockLevels(productId: ID!): StockLevel 
    
        # Fetch summary sales data for a specific product.
        getSalesSummary(productId: ID!): [Sale] 
    
        # Fetch total sales over time for a specific product.
        getTotalSalesOverTime(productId: ID!, startDate: String!, endDate: String!): Float 
    
        # Fetch feedback summary as reviews for a specific product.
        getFeedbackSummary(productId: ID!): [Review] 
    

        # Fetch reviews for a specific product.
        getProductReviews(productId: Int!): [Review!]!

        # Fetch user feedback rating for a specific user.
        getUserFeedbackRating(userId: Int!): Float!
      
        # Fetch all reviews for a specific product, including user details.
        getAllReviews(productId: Int!): [Review!]!
      
        # Fetch reviews written by a specific user, including product details.
        getReviewsByUser(userId: Int!): [Review!]!
      
        # Fetch review statistics for a specific product.
        getReviewStats(productId: Int!): ReviewStats!
      
        # Fetch the 5 most recent reviews for a specific product.
        getRecentFeedbackAndReviews(productId: Int!): [Review!]!
      
        # Fetch average rating for a specific user.
        getUserAverageRating(userId: Int!): Float!

        # Fetch top-rated products.
        getTopRatedProducts: [Product] 
    
        # Fetch top-selling products.
        getTopSellingProducts: [Product] 
    
        # Fetch availability status for a specific product.
        getProductAvailability(productId: ID!): ProductAvailability! 
    
        # Purchases Queries
        # Fetch all purchases made by a specific user.
        getUserPurchases(userId: Int!): [Purchase!]! 
    
        # Fetch a specific purchase by its unique ID.
        getPurchaseById(purchaseId: Int!): Purchase! 
    
        # Sales Queries
        # Fetch all sales made by a specific user.
        getUserSales(userId: Int!): [Sale!]! 
    
        # Fetch a specific sale by its unique ID.
        getSaleById(saleId: Int!): Sale! 
    
        # Fetch a limited number of recent sales.
        getRecentSales(limit: Int!): [Sale!]! 
    
        # Product Feedback Queries
        # Fetch all feedback entries related to a specific product.
        getProductFeedback(productId: Int!): [Feedback!]! 
    
        # Product Comments Queries
        # Fetch comments made on a specific product.
        getProductComments(productId: Int!): [Comment!]! 
    
        # Product Tags Queries
        # Fetch tags associated with a specific product.
        getProductTags(productId: Int!): [ProductTag!]! 
    
        # Inventory Management Queries
        # Fetch the stock level for a specific product.
        getProductStockLevels(productId: Int!): Int! 
    
        # Product Variants Queries
        # Fetch all variants for a specific product.
        getProductVariants(productId: Int!): [ProductVariant!]! 
    
        # Bundles Queries
        # Fetch bundles that include a specific product.
        getProductBundles(productId: Int!): [BundleProduct!]! 
    
        # User Engagement Metrics Queries
        # Fetch engagement metrics for a specific user.
        getUserEngagementMetrics(userId: Int!): [EngagementMetric!]! 
    
        # Report Queries
        # Fetch reports filed against a specific product.
        getProductReports(productId: Int!): [Report!]! 
    
        # Wishlist Management Queries
        # Fetch a user's wishlist.
        getUserWishlist(userId: Int!): [Wishlist!]! 
    
        # Raffle Management Queries
        # Fetch all products that have active raffles.
        getAllProductsWithRaffles: [Product] 
    
        # Fetch all raffles for a specific product by its ID.
        getRafflesForProduct(productId: Int!): [Raffle] 
    
        # Fetch details for a specific raffle by its ID.
        getRaffleDetails(raffleId: Int!): Raffle 
    
        # Fetch all active (open) raffles.
        getActiveRaffles: [Raffle] 
    
        # Fetch all closed raffles.
        getClosedRaffles: [Raffle] 
    
        # Fetch all canceled raffles.
        getCanceledRaffles: [Raffle] 
    
        # Fetch all raffle entries for a specific user by their user ID.
        getUsersRaffleEntries(userId: Int!): [RaffleEntry] 
    
        # Fetch raffles filtered by their type.
        getRafflesByType(raffleType: RaffleType!): [Raffle] 
    
        # Fetch winners of a specific raffle by its ID.
        getRaffleWinners(raffleId: Int!): [RaffleEntry] 
    
        # Fetch losers of a specific raffle by its ID.
        getRaffleLosers(raffleId: Int!): [RaffleEntry] 
    
        # Fetch raffle entries filtered by result status (e.g., won, lost).
        getEntriesByResult(raffleId: Int!, result: RaffleResult!): [RaffleEntry] 
    
        # Fetch raffles for a specific user based on their entries.
        getRafflesForUser(userId: Int!): [Raffle] 
    
        # Fetch raffles filtered by a specific product.
        getRafflesByProduct(productId: Int!): [Raffle] 
    
        # Fetch recent raffles with a limit on the number of results.
        getRecentRaffles(limit: Int!): [Raffle] 
    
        # Fetch a user's raffle history by their user ID.
        getUsersRaffleHistory(userId: Int!): [RaffleEntry] 
    
        # Fetch the count of entries for a specific raffle by its ID.
        getRaffleEntryCount(raffleId: Int!): Int 
    
        # Fetch raffles that are ending soon with a limit on the number of results.
        getRafflesEndingSoon(limit: Int!): [Raffle] 
    
        # Fetch the winning percentage of a specific user by their user ID.
        getUserWinningPercentage(userId: Int!): Float 
    
        # Fetch winners of a specific raffle within a date range.
        getRaffleWinnersByDateRange(startDate: String!, endDate: String!): [RaffleEntry] 
    
        # Fetch raffles that have no entries.
        getRafflesWithNoEntries: [Raffle] 
    
        # Fetch raffle entries with associated user details.
        getRaffleEntriesWithUsers: [RaffleEntry] 
    
        # Fetch raffles that have no winners.
        getRafflesWithNoWinners: [Raffle] 
    
        # Fetch winners filtered by the type of raffle.
        getRaffleWinnersByRaffleType(raffleType: RaffleType!): [RaffleEntry] 
    
        # Fetch upcoming raffles.
        getUpcomingRaffles: [Raffle] 
    
        # Fetch finished raffles.
        getFinishedRaffles: [Raffle] 
    
        # Fetch raffles that a specific user has entered.
        getUserEnteredRaffles(userId: Int!): [Raffle] 
    
        # Fetch raffles filtered by a specific date range.
        getRafflesByDateRange(startDate: String!, endDate: String!): [Raffle] 
    
        # Fetch recent winners with a limit on the number of results.
        getRecentWinners(limit: Int!): [RaffleEntry] 
    
        # Fetch raffles filtered by a minimum number of entries.
        getRafflesByMinEntryCount(minCount: Int!): [Raffle] 
    
        # Fetch a user's participation rate in raffles.
        getUserParticipationRate(userId: Int!): Float 
    
        # Fetch a user's winning streak in raffles.
        getUsersWinningStreak(userId: Int!): Int 
    
        # Fetch the most entered raffles for a specific user.
        getMostEnteredRafflesForUser(userId: Int!): [Raffle] 
    
        # Fetch raffles ordered by entry count.
        getRafflesOrderedByEntryCount: [Raffle] 
    
        # Fetch popular raffles based on some criteria (e.g., number of entries).
        getPopularRaffles: [Raffle] 
    }    
      
    `,
    resolvers: {
      Date: dateScalar,
      DateTime: dateTimeScalar,
      JSON: GraphQLJSON,
      Query: {
        // Fetches user details for the specified user ID.
        // SELECT * FROM users
        // WHERE id = userId;
        getUserById: async (_, { userId }) => {
          return await prisma.user.findUnique({
            // WHERE id = userId
            where: { id: userId }, // Filter by user ID
          });
        },
        // Fetches a list of all users from the database.
        // SELECT * FROM users;
        getAllUsers: async () => {
          // SELECT * FROM users;
          return await prisma.user.findMany();
        },
        // Fetches the most recently registered users.
        // SELECT * FROM users
        // ORDER BY createdAt DESC
        // LIMIT limit;
        getRecentUsers: async (_, { limit }) => {
          return await prisma.user.findMany({
            // SELECT * FROM users
            orderBy: { createdAt: "desc" }, // ORDER BY createdAt DESC
            take: limit, // LIMIT limit
          });
        },
        // Fetches users who registered within a specific date range.
        // SELECT * FROM users
        // WHERE createdAt BETWEEN startDate AND endDate;
        getUsersByRegistrationDateRange: async (_, { startDate, endDate }) => {
          return await prisma.user.findMany({
            // SELECT * FROM users
            where: {
              // WHERE createdAt BETWEEN startDate AND endDate
              createdAt: {
                gte: startDate, // Greater than or equal to startDate
                lte: endDate, // Less than or equal to endDate
              },
            },
          });
        },
        // Fetches all products favorited by a specific user.
        // SELECT * FROM products
        // WHERE id IN (SELECT productId FROM favorites WHERE userId = userId);
        getUserFavorites: async (_, { userId }) => {
          return await prisma.product.findMany({
            // SELECT * FROM products
            where: {
              // WHERE id IN (SELECT productId FROM favorites WHERE userId = userId)
              favoritedBy: { some: { id: userId } }, // Filter by favoritedBy
            },
          });
        },
        // Fetches products that a specific user has viewed.
        // SELECT * FROM products
        // INNER JOIN viewedProducts ON products.id = viewedProducts.productId
        // WHERE viewedProducts.userId = userId;
        getUserViewedProducts: async (_, { userId }) => {
          return await prisma.product.findMany({
            // SELECT * FROM products
            where: {
              // INNER JOIN viewedProducts ON products.id = viewedProducts.productId
              viewedBy: { some: { id: userId } }, // Filter by viewedBy
            },
          });
        },
        // Fetches the search history of a specific user.
        // SELECT * FROM searchHistory
        // WHERE userId = userId;
        // INNER JOIN users ON searchHistory.userId = users.id;
        getUserSearchHistory: async (_, { userId }) => {
          return await prisma.searchHistory.findMany({
            // SELECT * FROM searchHistory
            where: {
              // WHERE userId = userId
              userId, // Filter by user ID
            },
            // INNER JOIN users ON searchHistory.userId = users.id;
            include: {
              user: true, // Include user information related to the search history
            },
          });
        },
        // Fetches products along with their reviews based on the review score (percentage).
        // SELECT products.*, reviews.* FROM products
        // INNER JOIN reviews ON products.id = reviews.productId
        // WHERE reviews.percentage >= 75;
        getProductsWithHighReviews: async () => {
          // SELECT products.*, reviews.* FROM products
          return await prisma.product.findMany({
            // INNER JOIN reviews ON products.id = reviews.productId
            include: {
              reviews: {
                // WHERE reviews.percentage >= 75
                where: {
                  percentage: {
                    gte: 75, // Only include reviews with a percentage score of 75 or higher
                  },
                },
              },
            },
            where: {
              // Filter for active products
              status: "ACTIVE",
            },
          });
        },
        // Fetches products along with their reviews based on the review score (percentage).
        // SELECT products.*, reviews.* FROM products
        // INNER JOIN reviews ON products.id = reviews.productId
        // WHERE reviews.percentage >= 25;
        getProductsWithLowReviews: async () => {
          // SELECT products.*, reviews.* FROM products
          return await prisma.product.findMany({
            // INNER JOIN reviews ON products.id = reviews.productId
            include: {
              reviews: {
                // WHERE reviews.percentage <= 25
                where: {
                  percentage: {
                    lte: 25, // Only include reviews with a percentage score of 25 or lower
                  },
                },
              },
            },
            where: {
              // Filter for active products
              status: "ACTIVE",
            },
          });
        },
        // Fetches all feedback provided by a specific user.
        // SELECT * FROM review
        // WHERE userId = userId;
        getUserReviews: async (_, { userId }) => {
          return await prisma.review.findMany({
            // SELECT * FROM reviews
            where: {
              // WHERE userId = userId
              userId, // Filter by user ID
            },
          });
        },
        // Fetches all messages sent by a specific user.
        // SELECT * FROM messages
        // WHERE senderId = userId;
        getUserSentMessages: async (_, { userId }) => {
          return await prisma.message.findMany({
            // SELECT * FROM messages
            where: {
              // WHERE senderId = userId
              senderId: userId, // Filter by sender ID
            },
          });
        },
        // Fetches all messages received by a specific user.
        // SELECT * FROM messages
        // WHERE receiverId = userId;
        getUserReceivedMessages: async (_, { userId }) => {
          return await prisma.message.findMany({
            // SELECT * FROM messages
            where: {
              // WHERE receiverId = userId
              receiverId: userId, // Filter by receiver ID
            },
          });
        },
        // Fetches the total number of products listed by a specific user.
        // SELECT COUNT(*) FROM products
        // WHERE sellerId = userId;
        getUserProductCount: async (_, { userId }) => {
          return await prisma.product.count({
            // SELECT COUNT(*) FROM products
            where: {
              // WHERE sellerId = userId
              sellerId: userId, // Filter by seller ID
            },
          });
        },
        // Fetches the total number of followers for a specific user.
        // SELECT COUNT(*) FROM userFollows
        // WHERE followedId = userId;
        getUserFollowerCount: async (_, { userId }) => {
          return await prisma.userFollow.count({
            // SELECT COUNT(*) FROM userFollows
            where: {
              // WHERE followedId = userId
              followedId: userId, // Filter by followed user ID
            },
          });
        },
        // Fetches the total number of users a specific user is following.
        // SELECT COUNT(*) FROM userFollows
        // WHERE followerId = userId;
        getUserFollowingCount: async (_, { userId }) => {
          return await prisma.userFollow.count({
            // SELECT COUNT(*) FROM userFollows
            where: {
              // WHERE followerId = userId
              followerId: userId, // Filter by follower user ID
            },
          });
        },
        // Fetches user activity statistics.
        // SELECT COUNT(*) FROM userActivity
        // WHERE userId = userId;
        getUserActivityCount: async (_, { userId }) => {
          return await prisma.userActivity.count({
            // SELECT COUNT(*) FROM userActivity
            where: {
              // WHERE userId = userId
              userId, // Filter by user ID
            },
          });
        },
        // Fetches all followers of a specific user.
        // SELECT * FROM users
        // INNER JOIN userFollows ON users.id = userFollows.followerId
        // WHERE userFollows.followedId = userId;
        getUserFollowers: async (_, { userId }) => {
          return await prisma.userFollow.findMany({
            // SELECT * FROM userFollows
            where: {
              // WHERE followedId = userId
              followedId: userId, // Filter by followed user ID
            },
            // INNER JOIN userFollows ON users.id = userFollows.followerId
            include: {
              follower: true, // Include follower details from users table
            },
          });
        },
        // Fetches all users that a specific user is following.
        // SELECT * FROM users
        // INNER JOIN userFollows ON users.id = userFollows.followedId
        // WHERE userFollows.followerId = userId;
        getUserFollowing: async (_, { userId }) => {
          return await prisma.userFollow.findMany({
            // SELECT * FROM userFollows
            where: {
              // WHERE followerId = userId
              followerId: userId, // Filter by follower user ID
            },
            // INNER JOIN userFollows ON users.id = userFollows.followedId
            include: {
              followed: true, // Include followed user details from users table
            },
          });
        },
        // Fetches all users with the admin role.
        // SELECT * FROM users
        // WHERE role = 'ADMIN';
        getAdminUsers: async () => {
          return await prisma.user.findMany({
            // SELECT * FROM users
            where: {
              // WHERE role = 'ADMIN'
              role: "ADMIN", // Filter by role 'ADMIN'
            },
          });
        },
        // Fetches all users with the moderator role.
        // SELECT * FROM users
        // WHERE role = 'MODERATOR';
        getModeratorUsers: async () => {
          return await prisma.user.findMany({
            // SELECT * FROM users
            where: {
              // WHERE role = 'MODERATOR'
              role: "MODERATOR", // Filter by role 'MODERATOR'
            },
          });
        },
        // Fetches all users with the regular user role.
        // SELECT * FROM users
        // WHERE role = 'USER';
        getRegularUsers: async () => {
          return await prisma.user.findMany({
            // SELECT * FROM users
            where: {
              // WHERE role = 'USER'
              role: "USER", // Filter by role 'USER'
            },
          });
        },
        // Fetches the role of a specific user.
        // SELECT role FROM users
        // WHERE id = userId;
        getUserRoles: async (_, { userId }) => {
          return await prisma.user.findUnique({
            // SELECT role FROM users
            where: {
              // WHERE id = userId
              id: userId, // Filter by user ID
            },
            select: { role: true }, // Directly fetch the user's role
          });
        },
        // Fetches all users with the specified role.
        // SELECT * FROM users
        // WHERE role = :role;
        getUsersByRole: async (_, { role }) => {
          return await prisma.user.findMany({
            // SELECT * FROM users
            where: {
              // WHERE role = :role
              role: role, // Filter users by the specified role
            },
          });
        },
        // Fetches all active users.
        // SELECT * FROM users
        // WHERE lastActive >= NOW() - INTERVAL '30 days';
        getActiveUsers: async () => {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // Calculate date 30 days ago
          // SELECT * FROM users
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
        // SELECT role, COUNT(*) as userCount FROM users
        // GROUP BY role;
        getUserRoleStatistics: async () => {
          // SELECT role, COUNT(*) as userCount FROM users
          return await prisma.user.groupBy({
            // GROUP BY role;
            by: ["role"],
            //  COUNT(*) as userCount FROM users
            _count: {
              role: true,
            },
          });
        },
        // Fetches all badges earned by a specific user.
        // SELECT * FROM userBadges
        // INNER JOIN badges ON userBadges.badgeId = badges.id
        // WHERE userId = userId;
        getUserBadges: async (_, { userId }) => {
          return await prisma.userBadge.findMany({
            // SELECT * FROM userBadges
            where: {
              // WHERE userId = userId
              userId, // Filter by userId
            },
            // INNER JOIN badges ON userBadges.badgeId = badges.id
            include: {
              badge: true, // Include details of each badge from badges table
            },
          });
        },
        // Fetches all achievements earned by a specific user.
        // SELECT * FROM userAchievements
        // INNER JOIN achievements ON userAchievements.achievementId = achievements.id
        // WHERE userId = userId;
        getUserAchievements: async (_, { userId }) => {
          // SELECT * FROM userAchievements
          return await prisma.userAchievement.findMany({
            // WHERE userId = userId
            where: {
              userId, // Filter by userId
            },
            // INNER JOIN achievements ON userAchievements.achievementId = achievements.id
            include: {
              achievement: true, // Include achievement details
            },
          });
        },
        // Fetches all notifications for a specific user.
        // SELECT * FROM notifications
        // WHERE userId = userId;
        getUserNotifications: async (_, { userId }) => {
          // SELECT * FROM notifications
          return await prisma.notification.findMany({
            // WHERE userId = userId
            where: {
              userId, // Filter by userId
            },
          });
        },
        // Fetches all notifications that are unread for a specific user.
        // SELECT * FROM notifications
        // WHERE userId = userId AND read = false;
        getUserUnreadNotifications: async (_, { userId }) => {
          // SELECT * FROM notifications
          return await prisma.notification.findMany({
            // WHERE userId = userId AND read = false
            where: {
              userId, // Filter by userId
              read: false, // Filter for unread notifications
            },
          });
        },
        // Fetches all languages spoken by a specific user.
        // SELECT * FROM languages
        // WHERE userId = userId AND active = true;
        // INNER JOIN languages ON users.id = languages.userId;
        getUserLanguage: async (_, { userId }) => {
          // SELECT * FROM users
          return await prisma.user.findUnique({
            // WHERE id = userId
            where: {
              id: userId, // Find the user by their ID
            },
            // INNER JOIN languages ON users.id = languages.userId;
            include: {
              language: true, // Include the language associated with the user
            },
          });
        },
        // Fetches the user's bio, username and profile information.
        // SELECT bio,username, profilePicture FROM users
        // WHERE id = userId;
        getUserProfileInfo: async (_, { userId }) => {
          // SELECT bio, username, profilePicture FROM users
          return await prisma.user.findUnique({
            where: {
              // WHERE id = userId
              id: userId,
            },
            select: {
              bio: true, // Include bio
              username: true, // Include username
              profilePicture: true, // Include profile picture
            },
          });
        },
        // Fetches all ratings associated with a specific user.
        // SELECT * FROM userRatings
        // WHERE raterId = userId OR ratedId = userId;
        getUserRatings: async (_, { userId }) => {
          // SELECT * FROM userRatings
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
        // SELECT * FROM userRatings
        // WHERE raterId = userId;
        getUserRatingsGiven: async (_, { userId }) => {
          // SELECT * FROM userRatings
          return await prisma.userRating.findMany({
            // WHERE raterId = userId
            where: {
              raterId: userId,
            },
          });
        },
        // Fetches ratings received by a specific user.
        // SELECT * FROM userRatings
        // WHERE ratedId = userId;
        getUserRatingsReceived: async (_, { userId }) => {
          // SELECT * FROM userRatings
          return await prisma.userRating.findMany({
            // WHERE ratedId = userId
            where: {
              ratedId: userId,
            },
          });
        },
        // Fetches the user's activity log.
        // SELECT * FROM userActivity
        // WHERE userId = userId;
        getUserActivityLog: async (_, { userId }) => {
          // SELECT * FROM userActivity
          return await prisma.userActivity.findMany({
            // WHERE userId = userId
            where: {
              userId,
            },
          });
        },
        // Fetches all saved searches by a specific user.
        // SELECT * FROM savedSearches
        // WHERE userId = userId;
        getUserSavedSearches: async (_, { userId }) => {
          // SELECT * FROM savedSearches
          return await prisma.savedSearch.findMany({
            // WHERE userId = userId
            where: {
              userId,
            },
          });
        },
        // Fetches a list of all users from the database.
        // SELECT * FROM product;
        getAllProducts: async () => {
          // SELECT * FROM product;
          return await prisma.product.findMany();
        },
        // Fetches user details for the specified user ID.
        // SELECT * FROM users
        // WHERE id = productId;
        getProductById: async (_, { productId }) => {
          // SELECT * FROM users
          return await prisma.user.findUnique({
            // WHERE id = productId;
            where: { id: productId }, // Filter by product ID
          });
        },
        // Fetches all products listed by a specific user.
        // SELECT * FROM products
        // WHERE sellerId = userId;
        getUserProducts: async (_, { userId }) => {
          // SELECT * FROM products
          return await prisma.product.findMany({
            // WHERE sellerId = userId
            where: {
              sellerId: userId,
            },
          });
        },
        // Fetches a list of products by the specified seller ID.
        // SELECT * FROM products
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId;
        // LEFT JOIN productRatings ON products.id = productRatings.productId;
        // LEFT JOIN comments ON products.id = comments.productId;
        // WHERE sellerId = sellerId;
        getProductsBySeller: async (_, { sellerId }) => {
          // SELECT * FROM products
          return await prisma.product.findMany({
            // WHERE sellerId = sellerId
            where: {
              sellerId, // Filter products by seller ID
            },
            include: {
              // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for the product
              seller: true,
              // LEFT JOIN media ON products.id = media.productId; // Include media related to the product
              media: true,
              // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              ratings: {
                // LEFT JOIN users ON productRatings.userId = users.id; // Include user details who gave the rating
                include: {
                  user: true, // Include user details who gave the rating
                },
              },
              // LEFT JOIN comments ON products.id = comments.productId; // Include comments for each product
              comments: {
                // LEFT JOIN users ON comments.userId = users.id; // Include user details for comments
                include: {
                  user: true, // Include user details for comments
                },
              },
            },
          });
        },

        // Fetches products by condition.
        // SELECT * FROM products
        // LEFT JOIN users ON products.sellerId = users.id;
        // WHERE condition = conditionType;
        getProductsByCondition: async (_, { conditionType }) => {
          return await prisma.product.findMany({
            where: {
              condition: conditionType, // WHERE condition = conditionType; // Filter products by condition type
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for the product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to the product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for the product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on the product
            },
          });
        },

        // Fetches products by brand ID.
        // SELECT * FROM products
        // LEFT JOIN users ON products.sellerId = users.id;
        // WHERE brandId = brandId;
        getProductsByBrand: async (_, { brandId }) => {
          return await prisma.product.findMany({
            where: {
              brandId, // WHERE brandId = brandId; // Filter products by brand ID
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for the product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to the product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for the product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on the product
            },
          });
        },

        // Fetches the most recent products.
        // SELECT * FROM products
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId;
        // LEFT JOIN productRatings ON products.id = productRatings.productId;
        // LEFT JOIN comments ON products.id = comments.productId;
        // ORDER BY createdAt DESC LIMIT limit;
        getRecentProducts: async (_, { limit }) => {
          return await prisma.product.findMany({
            orderBy: { createdAt: "desc" }, // ORDER BY createdAt DESC; // Sort products by creation date in descending order
            take: limit, // LIMIT limit; // Limit the number of products returned
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for the product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to the product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for the product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on the product
            },
          });
        },

        // Fetches products by category.
        // SELECT * FROM products
        // INNER JOIN productCategories ON products.id = productCategories.productId;
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId;
        // LEFT JOIN productRatings ON products.id = productRatings.productId;
        // LEFT JOIN comments ON products.id = comments.productId;
        // WHERE productCategories.categoryId = categoryId;
        getProductsByCategory: async (_, { categoryId }) => {
          return await prisma.product.findMany({
            where: {
              categories: {
                some: {
                  categoryId, // WHERE productCategories.categoryId = categoryId; // Filter products by the specified category ID
                },
              },
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to the product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on each product
            },
          });
        },

        // Fetches products within the price range.
        // SELECT * FROM products
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId;
        // LEFT JOIN productRatings ON products.id = productRatings.productId;
        // LEFT JOIN comments ON products.id = comments.productId;
        // WHERE price BETWEEN minPrice AND maxPrice;
        getProductsByPriceRange: async (_, { minPrice, maxPrice }) => {
          return await prisma.product.findMany({
            where: {
              price: {
                gte: minPrice, // WHERE price >= minPrice; // Filter products with price greater than or equal to minPrice
                lte: maxPrice, // AND price <= maxPrice; // Filter products with price less than or equal to maxPrice
              },
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on each product
            },
          });
        },

        // Fetches products by country.
        // SELECT * FROM products
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId;
        // LEFT JOIN productRatings ON products.id = productRatings.productId;
        // LEFT JOIN comments ON products.id = comments.productId;
        // WHERE countryId = countryId;
        getProductsByCountry: async (_, { countryId }) => {
          return await prisma.product.findMany({
            where: { countryId }, // WHERE countryId = countryId; // Filter products by the specified country ID
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on each product
            },
          });
        },

        // Fetches products favorited by the user.
        // SELECT * FROM products
        // INNER JOIN favorites ON products.id = favorites.productId;
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId;
        // LEFT JOIN productRatings ON products.id = productRatings.productId;
        // LEFT JOIN comments ON products.id = comments.productId;
        // WHERE favorites.userId = userId;
        getFavoritedProducts: async (_, { userId }) => {
          return await prisma.product.findMany({
            where: {
              favoritedBy: {
                some: {
                  id: userId, // WHERE favorites.userId = userId; // Filter products favorited by the specified user ID
                },
              },
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on each product
            },
          });
        },

        // Fetches products by tag.
        // SELECT * FROM products
        // INNER JOIN productTags ON products.id = productTags.productId;
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId;
        // LEFT JOIN productRatings ON products.id = productRatings.productId;
        // LEFT JOIN comments ON products.id = comments.productId;
        // WHERE productTags.tagId = tagId;
        getProductsByTag: async (_, { tagId }) => {
          return await prisma.product.findMany({
            where: {
              tags: {
                some: {
                  tagId, // WHERE productTags.tagId = tagId; // Filter products by the specified tag ID
                },
              },
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on each product
            },
          });
        },

        // Fetches products with multiple tags.
        // SELECT * FROM products
        // INNER JOIN productTags ON products.id = productTags.productId;
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId;
        // LEFT JOIN productRatings ON products.id = productRatings.productId;
        // LEFT JOIN comments ON products.id = comments.productId;
        // WHERE productTags.tagId IN (tagIds);
        getProductsByMultipleTags: async (_, { tagIds }) => {
          return await prisma.product.findMany({
            where: {
              tags: {
                some: {
                  tagId: { in: tagIds }, // WHERE productTags.tagId IN (tagIds); // Filter products by the specified list of tag IDs
                },
              },
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on each product
            },
          });
        },

        // Fetches the most viewed products.
        // SELECT * FROM products
        // LEFT JOIN viewedProducts ON products.id = viewedProducts.productId
        // LEFT JOIN users ON products.sellerId = users.id
        // LEFT JOIN media ON products.id = media.productId
        // LEFT JOIN productRatings ON products.id = productRatings.productId
        // LEFT JOIN comments ON products.id = comments.productId
        // ORDER BY (SELECT COUNT(*) FROM viewedProducts WHERE productId = products.id) DESC
        // LIMIT limit;
        getMostViewedProducts: async (_, { limit }) => {
          return await prisma.product.findMany({
            orderBy: {
              viewedBy: {
                _count: "desc", // SQL: ORDER BY (SELECT COUNT(*) FROM viewedProducts WHERE productId = products.id) DESC; // Sort by view count in descending order
              },
            },
            take: limit, // SQL: LIMIT limit; // Limit the number of products returned
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on each product
            },
          });
        },
        // Fetches products that are available in stock.
        // SELECT * FROM products
        // LEFT JOIN users ON products.sellerId = users.id
        // LEFT JOIN media ON products.id = media.productId
        // LEFT JOIN productRatings ON products.id = productRatings.productId
        // LEFT JOIN comments ON products.id = comments.productId
        // WHERE stock > 0;
        getInStockProducts: async () => {
          return await prisma.product.findMany({
            where: {
              stock: {
                gt: 0, // WHERE stock > 0; // Filter products that have stock greater than 0
              },
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on each product
            },
          });
        },
        // Fetches products that meet or exceed a specified minimum average rating.
        // SELECT * FROM products
        // LEFT JOIN ratings ON products.id = ratings.productId
        // LEFT JOIN users ON products.sellerId = users.id
        // LEFT JOIN media ON products.id = media.productId
        // LEFT JOIN productRatings ON products.id = productRatings.productId
        // LEFT JOIN comments ON products.id = comments.productId
        // WHERE id IN (SELECT productId FROM ratings GROUP BY productId HAVING AVG(score) >= minRating);
        getProductsByMinRating: async (_, { minRating }) => {
          return await prisma.product.findMany({
            where: {
              ratings: {
                some: {
                  rating: {
                    gte: minRating, // SQL: HAVING AVG(score) >= minRating; // Filter products with average rating greater than or equal to minRating
                  },
                },
              },
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, //  LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, //  LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on each product
            },
          });
        },
        // Fetches products that a specific user has added to their wishlist.
        // SELECT * FROM products
        // INNER JOIN wishlists ON products.id = wishlists.productId
        // LEFT JOIN users ON products.sellerId = users.id
        // LEFT JOIN media ON products.id = media.productId
        // LEFT JOIN productRatings ON products.id = productRatings.productId
        // LEFT JOIN comments ON products.id = comments.productId
        // WHERE wishlists.userId = userId;
        getWishlistProducts: async (_, { userId }) => {
          return await prisma.product.findMany({
            where: {
              wishlistedBy: {
                some: {
                  id: userId, // SQL: WHERE wishlists.userId = userId; // Filter products in the user's wishlist
                },
              },
            },
            include: {
              seller: true, //  LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, //  LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, //  LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments on each product
            },
          });
        },
        // Fetches products ordered by price in a specified direction (ascending or descending)
        // SELECT * FROM products
        // ORDER BY price ASC|DESC
        // LIMIT limit;
        // LEFT JOIN users ON products.sellerId = users.id
        // LEFT JOIN media ON products.id = media.productId
        // LEFT JOIN productRatings ON products.id = productRatings.productId
        // LEFT JOIN comments ON products.id = comments.productId
        getProductsSortedByPrice: async (_, { order, limit }) => {
          return await prisma.product.findMany({
            orderBy: { price: order === "asc" ? "asc" : "desc" }, // SQL: ORDER BY price ASC|DESC; // Sort products by price
            take: limit, // SQL: LIMIT limit; // Limit the number of products returned
            include: {
              seller: true, // SQL: LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // SQL: LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // SQL: LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // SQL: LEFT JOIN comments ON products.id = comments.productId; // Include comments on each product
            },
          });
        },
        // Fetches products listed by a specific seller, ordered by the most recent
        // SELECT * FROM products
        // WHERE sellerId = sellerId
        // ORDER BY createdAt DESC
        // LEFT JOIN users ON products.sellerId = users.id
        // LEFT JOIN media ON products.id = media.productId
        // LEFT JOIN productRatings ON products.id = productRatings.productId
        // LEFT JOIN comments ON products.id = comments.productId
        getRecentProductsBySeller: async (_, { sellerId }) => {
          return await prisma.product.findMany({
            where: { sellerId }, // SQL: WHERE sellerId = sellerId; // Filter products by the seller's ID
            orderBy: { createdAt: "desc" }, // SQL: ORDER BY createdAt DESC; // Sort by creation date, newest first
            include: {
              seller: true, // SQL: LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // SQL: LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // SQL: LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // SQL: LEFT JOIN comments ON products.id = comments.productId; // Include comments for each product
            },
          });
        },
        // Fetches products that belong to a specified bundle
        // SELECT * FROM products
        // INNER JOIN bundleProducts ON products.id = bundleProducts.productId
        // LEFT JOIN users ON products.sellerId = users.id
        // LEFT JOIN media ON products.id = media.productId
        // LEFT JOIN productRatings ON products.id = productRatings.productId
        // LEFT JOIN comments ON products.id = comments.productId
        // WHERE bundleProducts.bundleId = bundleId;
        getProductsByBundle: async (_, { bundleId }) => {
          return await prisma.product.findMany({
            where: {
              bundles: {
                some: {
                  id: bundleId, // SQL: WHERE bundleProducts.bundleId = bundleId; // Filter products by the specified bundle ID
                },
              },
            },
            include: {
              seller: true, // SQL: LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // SQL: LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // SQL: LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // SQL: LEFT JOIN comments ON products.id = comments.productId; // Include comments for each product
            },
          });
        },
        // Fetches products that were released on a specified date
        // SELECT * FROM products
        // WHERE releaseDate = releaseDate
        // LEFT JOIN users ON products.sellerId = users.id
        // LEFT JOIN media ON products.id = media.productId
        // LEFT JOIN productRatings ON products.id = productRatings.productId
        // LEFT JOIN comments ON products.id = comments.productId
        getProductsByReleaseDate: async (_, { releaseDate }) => {
          return await prisma.product.findMany({
            where: { releaseDate }, // WHERE releaseDate = releaseDate; // Filter products by the release date
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments for each product
            },
          });
        },
        // Fetches the top sellers based on the count of their listed products
        // SELECT sellerId, COUNT(*) as productCount FROM products
        // GROUP BY sellerId
        // ORDER BY productCount DESC
        // LIMIT 10;
        getTopSellers: async () => {
          const topSellers = await prisma.product.groupBy({
            by: ["sellerId"], // Group by sellerId
            _count: {
              sellerId: true, // Count the number of products per seller
            },
            orderBy: {
              _count: {
                sellerId: "desc", // Order by product count in descending order
              },
            },
            take: 10, // Limit to top 10 sellers
          });
          // Fetch seller details for each top seller
          const sellerDetails = await Promise.all(
            topSellers.map(async (seller) => {
              const sellerInfo = await prisma.user.findUnique({
                where: { id: seller.sellerId }, // SQL: WHERE id = seller.sellerId; // Get seller information
              });
              return {
                ...sellerInfo, // Spread seller info
                productCount: seller._count.sellerId, // Include the product count
              };
            })
          );

          return sellerDetails; // Return detailed seller information
        },
        // Fetches the most sold products based on when they were sold
        // SELECT * FROM products
        // WHERE soldAt IS NOT NULL
        // ORDER BY soldAt DESC
        // LIMIT 10;
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId;
        // LEFT JOIN productRatings ON products.id = productRatings.productId
        // LEFT JOIN comments ON products.id = comments.productId;
        // Fetches the most sold products based on when they were sold
        getTopSoldProducts: async () => {
          return await prisma.product.findMany({
            where: {
              soldAt: {
                not: null, // WHERE soldAt IS NOT NULL; // Only include products that have been sold
              },
            },
            orderBy: {
              soldAt: "desc", // ORDER BY soldAt DESC; // Order by sold date, newest first
            },
            take: 10, // Limit to top 10 most sold products
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments for each product
            },
          });
        },
        // Calculate the total sales volume by summing the price of all products
        // SELECT SUM(price) FROM products;
        getTotalSalesVolume: async () => {
          // SELECT SUM(price) FROM products;
          return await prisma.product.aggregate({
            _sum: {
              price: true, // SUM(price); // Calculate the sum of product prices
            },
          });
        },

        // Count the total number of products that have been sold
        // SELECT COUNT(*) FROM products
        // WHERE soldAt IS NOT NULL;
        getTotalSalesCount: async () => {
          // SELECT COUNT(*) FROM products
          return await prisma.product.count({
            // WHERE soldAt IS NOT NULL;
            where: {
              soldAt: {
                not: null, // WHERE soldAt IS NOT NULL; // Count only sold products
              },
            },
          });
        },
        // Fetches the top 10 most favorited products
        // SELECT * FROM products
        // ORDER BY (SELECT COUNT(*) FROM favorites WHERE productId = products.id) DESC
        // LIMIT 10;
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId; 
        getMostFavoritedProducts: async () => {
          // SELECT * FROM products
          return await prisma.product.findMany({
            // ORDER BY (SELECT COUNT(*) FROM favorites WHERE productId = products.id) DESC
            orderBy: {
              favoritedBy: {
                _count: "desc", // SQL: ORDER BY (SELECT COUNT(*) FROM favorites WHERE productId = products.id) DESC; // Sort by favorite count
              },
            },
            // LIMIT 10;
            take: 10, // Limit to top 10 most favorited products
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
            },
          });
        },
        // Fetches the top 10 products with the most reviews

        // SELECT * FROM products
        // ORDER BY (SELECT COUNT(*) FROM reviews WHERE productId = products.id) DESC
        // LIMIT 10;
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId; 
        // LEFT JOIN productRatings ON products.id = productRatings.productId; 
        // LEFT JOIN comments ON products.id = comments.productId;
        getMostReviewedProducts: async () => {
          return await prisma.product.findMany({
            orderBy: {
              reviews: {
                _count: "desc", // SQL: ORDER BY (SELECT COUNT(*) FROM reviews WHERE productId = products.id) DESC; // Sort by review count
              },
            },
            take: 10, // Limit to top 10 most reviewed products
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details for each product
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments for each product
            },
          });
        },
        // Fetches products that have low stock (less than a specified threshold)
        // SELECT * FROM products
        // WHERE stock < 5;
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId;
        getLowStockProducts: async () => {
          return await prisma.product.findMany({
            where: {
              stock: {
                lt: 5, // SQL: WHERE stock < 5; // Filter products with stock less than 5
              },
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
            },
          });
        },
        // Fetches products along with their price history
        // SELECT * FROM products
        // INNER JOIN priceHistory ON products.id = priceHistory.productId;
        getStockMovement: async () => {
          return await prisma.product.findMany({
            include: {
              priceHistory: true, // SQL: LEFT JOIN priceHistory ON products.id = priceHistory.productId; // Include price history for each product
            },
          });
        },
        // Fetches products with stock below a specified threshold
        // SELECT * FROM products
        // WHERE stock < threshold;
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId; 
        // LEFT JOIN productRatings ON products.id = productRatings.productId;
        // LEFT JOIN comments ON products.id = comments.productId;
        getLowStockAlerts: async (_, { threshold }) => {
          return await prisma.product.findMany({
            where: {
              stock: {
                lt: threshold, // WHERE stock < threshold; // Filter products with stock below the specified threshold
              },
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments for each product
            },
          });
        },
        // Fetches products based on stock level
        // SELECT * FROM products
        // WHERE stock < 5;   // Low stock
        // SELECT * FROM products
        // WHERE stock >= 5 AND stock < 20; // Medium stock
        // SELECT * FROM products
        // WHERE stock >= 20; // High stock
        // LEFT JOIN users ON products.sellerId = users.id;
        // LEFT JOIN media ON products.id = media.productId;
        // LEFT JOIN productRatings ON products.id = productRatings.productId
        // LEFT JOIN comments ON products.id = comments.productId;
        getProductsByStockLevel: async (_, { stockLevel }) => {
          let condition; // Initialize condition for stock level
          // Determine the condition based on the specified stock level
          if (stockLevel === "low") {
            condition = { lt: 5 }; // Condition for low stock
            // SELECT * FROM products WHERE stock < 5;   // Low stock
          } else if (stockLevel === "medium") {
            condition = { gte: 5, lt: 20 }; // Condition for medium stock
            // SELECT * FROM products WHERE stock >= 5 AND stock < 20; // Medium stock
          } else if (stockLevel === "high") {
            condition = { gte: 20 }; // Condition for high stock
            // SELECT * FROM products WHERE stock >= 20; // High stock
          }
          return await prisma.product.findMany({
            where: {
              stock: condition, // Apply the condition based on stock level
            },
            include: {
              seller: true, // LEFT JOIN users ON products.sellerId = users.id; // Include seller details
              media: true, // LEFT JOIN media ON products.id = media.productId; // Include media related to each product
              ratings: true, // LEFT JOIN productRatings ON products.id = productRatings.productId; // Include ratings for each product
              comments: true, // LEFT JOIN comments ON products.id = comments.productId; // Include comments for each product
            },
          });
        },
        // Fetch products based on seller's minimum rating.
        // SELECT * FROM products p
        // JOIN users u ON p.sellerId = u.id
        // JOIN productRatings pr ON u.id = pr.userId
        // WHERE pr.rating >= minRating;
        getProductsBySellerRating: async (_, { minRating }) => {
          return await prisma.product.findMany({
            where: {
              seller: {
                productRating: {
                  some: {
                    rating: {
                      gte: minRating, // Condition for seller rating
                      // SQL: WHERE pr.rating >= minRating; // Filter for seller's rating
                    },
                  },
                },
              },
            },
            include: {
              seller: true, // JOIN users ON products.sellerId = users.id; // Include seller details
              media: true, // JOIN media ON products.id = media.productId; // Include media related to the product
              ratings: true, // JOIN productRatings ON products.id = productRatings.productId; // Include ratings for the product
              comments: true, // JOIN comments ON products.id = comments.productId; // Include comments on the product
            },
          });
        },
        // Fetches products based on seller's location.
        // SELECT * FROM products p
        // JOIN users u ON p.sellerId = u.id
        // WHERE u.location = location; // Filter for seller's location
        getProductsBySellerLocation: async (_, { location }) => {
          return await prisma.product.findMany({
            where: {
              seller: {
                location: {
                  equals: location, // SQL: WHERE u.location = location; // Match seller's location
                },
              },
            },
            include: {
              seller: true, // JOIN users ON products.sellerId = users.id; // Include seller details
              media: true, // JOIN media ON products.id = media.productId; // Include media related to the product
              ratings: true, // JOIN productRatings ON products.id = productRatings.productId; // Include ratings for the product
              comments: true, // JOIN comments ON products.id = comments.productId; // Include comments on the product
            },
          });
        },
        // Fetch products based on release date range.
        // SELECT * FROM products p
        // LEFT JOIN users u ON p.sellerId = u.id
        // LEFT JOIN media m ON p.id = m.productId
        // LEFT JOIN productRatings pr ON p.id = pr.productId
        // LEFT JOIN comments c ON p.id = c.productId
        // WHERE p.releaseDate >= startDate AND p.releaseDate <= endDate; // Filter for release date range
        getProductsByReleaseDateRange: async (_, { startDate, endDate }) => {
          return await prisma.product.findMany({
            where: {
              releaseDate: {
                gte: startDate, // WHERE p.releaseDate >= startDate; // Release date must be greater than or equal to start date
                lte: endDate, //  WHERE p.releaseDate <= endDate;   // Release date must be less than or equal to end date
              },
            },
            include: {
              seller: true, // LEFT JOIN users u ON p.sellerId = u.id; // Include seller details
              media: true, // LEFT JOIN media m ON p.id = m.productId; // Include media related to the product
              ratings: true, // LEFT JOIN productRatings pr ON p.id = pr.productId; // Include ratings for the product
              comments: true, // LEFT JOIN comments c ON p.id = c.productId; // Include comments on the product
            },
          });
        },
        // Fetch products based on multiple conditions.
        // SELECT * FROM products p
        // LEFT JOIN users u ON p.sellerId = u.id
        // LEFT JOIN media m ON p.id = m.productId
        // LEFT JOIN productRatings pr ON p.id = pr.productId
        // LEFT JOIN comments c ON p.id = c.productId
        // WHERE [Dynamic conditions based on provided conditions]; // Dynamic filtering based on provided conditions
        getProductsByMultipleConditions: async (
          _,
          { conditions }: { conditions: ConditionInput[] }
        ) => {
          return await prisma.product.findMany({
            where: {
              AND: conditions.map((condition) => ({
                [condition.field]: condition.value, // SQL: WHERE [condition.field] = [condition.value]; // Dynamic field filtering
              })),
            },
            include: {
              seller: true, // SQL: LEFT JOIN users u ON products.sellerId = u.id; // Include seller details
              media: true, // SQL: LEFT JOIN media m ON products.id = m.productId; // Include media related to the product
              ratings: true, // SQL: LEFT JOIN productRatings pr ON products.id = pr.productId; // Include ratings for the product
              comments: true, // SQL: LEFT JOIN comments c ON products.id = c.productId; // Include comments on the product
            },
          });
        },
        // Fetch products that have a minimum number of ratings.
        // SELECT * FROM products p
        // JOIN users u ON p.sellerId = u.id
        // JOIN productRatings pr ON p.id = pr.productId
        // LEFT JOIN media m ON p.id = m.productId
        // LEFT JOIN comments c ON p.id = c.productId
        // GROUP BY p.id
        // HAVING COUNT(pr.id) >= minRatingCount; // Ensure minimum rating count
        getProductsByRatingCount: async (_, { minRatingCount }) => {
          return await prisma.product
            .findMany({
              where: {
                ratings: {
                  some: {
                    // Here you can add conditions based on the rating if needed
                    // SQL: WHERE [conditions based on ratings]; // Optional conditions for ratings
                  },
                },
              },
              include: {
                seller: true, // SQL: JOIN users u ON products.sellerId = u.id; // Include seller details
                media: true, // SQL: LEFT JOIN media m ON products.id = m.productId; // Include media related to the product
                ratings: true, // SQL: JOIN productRatings pr ON products.id = pr.productId; // Include ratings for the product
                comments: true, // SQL: LEFT JOIN comments c ON products.id = c.productId; // Include comments on the product
              },
            })
            .then((products) => {
              // Filter products to ensure they meet the minimum rating count
              return products.filter(
                (product) => product.ratings.length >= minRatingCount
              );
              // SQL: HAVING COUNT(pr.id) >= minRatingCount; // Ensure minimum rating count
            });
        },
        // Fetch products based on seller's total sales.
        // SELECT * FROM products p
        // JOIN users u ON p.sellerId = u.id
        // JOIN productSales ps ON p.id = ps.productId
        // LEFT JOIN media m ON p.id = m.productId
        // LEFT JOIN productRatings pr ON p.id = pr.productId
        // LEFT JOIN comments c ON p.id = c.productId
        // GROUP BY p.id
        // HAVING COUNT(ps.id) >= minSales; // Ensure minimum sales count
        getProductsBySellerTotalSales: async (_, { minSales }) => {
          // Step 1: Fetch sellers with the minimum sales count
          const sellersWithMinSales = await prisma.user.findMany({
            where: {
              sales: {
                some: {}, // Adjust based on how you track sales
                // SQL: WHERE sales IS NOT NULL; // Filter for sellers with sales
              },
            },
            select: {
              id: true,
              _count: {
                select: {
                  sales: true, // Adjust according to your schema
                  // SQL: COUNT(sales.id) AS salesCount; // Count of sales for each seller
                },
              },
            },
          });
          // Filter sellers based on the minimum sales count
          const eligibleSellers = sellersWithMinSales
            .filter((seller) => seller._count.sales >= minSales)
            .map((seller) => seller.id);

          // Step 2: Fetch products from eligible sellers
          return await prisma.product.findMany({
            where: {
              sellerId: {
                in: eligibleSellers,
                // SQL: WHERE sellerId IN (SELECT id FROM users u JOIN productSales ps ON u.id = ps.sellerId GROUP BY u.id HAVING COUNT(ps.id) >= minSales); // Filter for eligible sellers
              },
            },
            include: {
              seller: true, // SQL: JOIN users u ON products.sellerId = u.id; // Include seller details
              media: true, // SQL: LEFT JOIN media m ON products.id = m.productId; // Include media related to the product
              ratings: true, // SQL: LEFT JOIN productRatings pr ON products.id = pr.productId; // Include ratings for the product
              comments: true, // SQL: LEFT JOIN comments c ON products.id = c.productId; // Include comments on the product
            },
          });
        },
        // Fetch a user's purchase history
        // SELECT * FROM purchases p
        // JOIN products pr ON p.productId = pr.id
        // JOIN users u ON p.userId = u.id
        // LEFT JOIN media m ON pr.id = m.productId
        // LEFT JOIN productRatings pr ON pr.id = productRatings.productId
        // LEFT JOIN comments c ON pr.id = comments.productId
        // WHERE p.userId = userId; // Filter purchases by user ID
        getUserPurchaseHistory: async (_, { userId }) => {
          return await prisma.purchase.findMany({
            where: {
              userId: userId, // Filter purchases by the user ID
              // SQL: WHERE userId = userId; // Condition to match user ID
            },
            include: {
              product: {
                include: {
                  seller: true, // SQL: JOIN users ON pr.sellerId = users.id; // Include seller details for the product
                  media: true, // SQL: LEFT JOIN media ON pr.id = media.productId; // Include media related to the product
                  ratings: true, // SQL: LEFT JOIN productRatings ON pr.id = productRatings.productId; // Include ratings for the product
                  comments: true, // SQL: LEFT JOIN comments ON pr.id = comments.productId; // Include comments on the product
                },
              },
              sale: {
                include: {
                  user: true, // SQL: JOIN users ON sale.userId = users.id; // Include the user details for the sale
                },
              },
            },
          });
        },
        // Fetch a user's sales history
        // SELECT * FROM sales s
        // JOIN products pr ON s.productId = pr.id
        // JOIN users u ON s.userId = u.id
        // LEFT JOIN media m ON pr.id = m.productId
        // LEFT JOIN productRatings pr ON pr.id = productRatings.productId
        // LEFT JOIN comments c ON pr.id = comments.productId
        // WHERE s.userId = userId; // Filter sales by user ID
        getUserSalesHistory: async (_, { userId }) => {
          return await prisma.sale.findMany({
            where: {
              userId: userId, // Filter sales by the user ID
              // SQL: WHERE userId = userId; // Condition to match user ID
            },
            include: {
              product: {
                include: {
                  seller: true, // SQL: JOIN users ON pr.sellerId = users.id; // Include seller details for the product
                  media: true, // SQL: LEFT JOIN media ON pr.id = media.productId; // Include media related to the product
                  ratings: true, // SQL: LEFT JOIN productRatings ON pr.id = productRatings.productId; // Include ratings for the product
                  comments: true, // SQL: LEFT JOIN comments ON pr.id = comments.productId; // Include comments on the product
                },
              },
              purchases: {
                include: {
                  user: true, // SQL: JOIN users ON purchases.userId = users.id; // Include the user details for the purchases
                },
              },
            },
          });
        },
        // Fetch products based on a specified profit margin.
        // SELECT p.id, p.title, p.price, p.cost FROM products p
        // LEFT JOIN media m ON p.id = m.productId // Include media related to the product
        // LEFT JOIN productRatings pr ON p.id = pr.productId // Include ratings for the product
        // LEFT JOIN comments c ON p.id = c.productId // Include comments related to the product
        // WHERE p.cost IS NOT NULL AND p.cost > 0; // Ensure valid cost for profit margin calculations
        getProductsByProfitMargin: async (_, { margin }) => {
          const products = await prisma.product.findMany({
            select: {
              id: true, // SQL: p.id
              title: true, // SQL: p.title
              price: true, // SQL: p.price
              cost: true, // SQL: p.cost
            },
          });
          // Filter products based on the specified profit margin
          const filteredProducts = products.filter((product) => {
            // Check if the cost is null or less than or equal to zero
            if (product.cost == null || product.cost <= 0) {
              return false; // Skip products that have no cost or invalid cost
            }

            // Calculate the profit margin using the formula:
            // Profit Margin = (Selling Price - Cost Price) / Cost Price
            const profitMargin = (product.price - product.cost) / product.cost;

            // Return true if the calculated profit margin meets or exceeds the specified margin
            return profitMargin >= margin; // Compare with the desired margin
          });

          // Return the filtered list of products that meet the profit margin criteria
          return filteredProducts;
        },
        // Fetch products that have been flagged a minimum number of times.
        // SELECT * FROM products p
        // JOIN productFlags pf ON p.id = pf.productId
        // LEFT JOIN users u ON p.sellerId = u.id
        // LEFT JOIN media m ON p.id = m.productId
        // LEFT JOIN comments c ON p.id = c.productId
        // GROUP BY p.id
        // HAVING COUNT(pf.id) >= minFlagCount; // Ensure minimum flag count
        getFlaggedProducts: async (
          _,
          { minFlagCount, flagReason, flagStatus }
        ) => {
          return await prisma.product
            .findMany({
              where: {
                flags: {
                  // Using 'some' to check if there are any flags present
                  some: {
                    // Optional filters for specific flag reasons or statuses
                    ...(flagReason ? { reason: flagReason } : {}),
                    ...(flagStatus ? { status: flagStatus } : {}),
                  },
                },
              },
              include: {
                seller: true, // SQL: JOIN users u ON p.sellerId = u.id; // Include seller information
                media: true, // SQL: LEFT JOIN media m ON p.id = m.productId; // Include media related to the product
                flags: true, // SQL: JOIN productFlags pf ON p.id = pf.productId; // Include flags to see how many times each product has been flagged
                comments: true, // SQL: LEFT JOIN comments c ON p.id = c.productId; // Include comments made on the product
              },
            })
            .then((products) => {
              // Filter products to ensure they meet the minimum flag count
              return products.filter(
                (product) => product.flags.length >= minFlagCount
              );
              // SQL: HAVING COUNT(pf.id) >= minFlagCount; // Ensure minimum flag count
            });
        },
        // Fetch the most listed products.
        // SELECT title, COUNT(id) AS listingCount FROM products
        // GROUP BY title
        // ORDER BY listingCount DESC
        // LIMIT limit;
        getMostListedProducts: async (_, { limit }) => {
          // Group by product title and count the number of listings
          const mostListedProducts = await prisma.product.groupBy({
            by: ["title"], // SQL: GROUP BY title; // Group by product title
            _count: {
              id: true, // SQL: COUNT(id) AS listingCount; // Count occurrences of products with the same title
            },
            orderBy: {
              _count: {
                id: "desc", // SQL: ORDER BY listingCount DESC; // Order by the count of listings
              },
            },
            take: limit, // SQL: LIMIT limit; // Limit the results
          });
          // Return the grouped results with listing counts
          return mostListedProducts.map((item) => ({
            title: item.title, // SQL: title; // Attach the title
            listingCount: item._count.id, // SQL: listingCount; // Attach the count to the title
          }));
        },
        // Fetch recently added products.
        // SELECT * FROM products p
        // LEFT JOIN media m ON p.id = m.productId // Include media related to the product (Left Join)
        // LEFT JOIN productRatings pr ON p.id = pr.productId // Include ratings for the product (Left Join)
        // LEFT JOIN comments c ON p.id = c.productId // Include comments related to the product (Left Join)
        // ORDER BY p.createdAt DESC LIMIT limit;
        getRecentlyAddedProducts: async (_, { limit }) => {
          return await prisma.product.findMany({
            orderBy: { createdAt: "desc" }, // SQL: ORDER BY createdAt DESC; // Order products by creation date
            take: limit, // SQL: LIMIT limit; // Limit the number of products returned
          });
        },
        // Fetch products by a specific flag status.
        // SELECT * FROM products p
        // INNER JOIN productFlags pf ON pf.productId = p.id AND pf.status = flagStatus; // Filter products by flag status (Inner Join)
        getProductsByFlagStatus: async (_, { flagStatus }) => {
          return await prisma.product.findMany({
            where: { flags: { some: { status: flagStatus } } }, // SQL: WHERE flags.status = flagStatus; // Filter products by flag status
          });
        },
        // Fetch ratings for a specific product.
        // SELECT * FROM productRatings pr
        // WHERE pr.productId = productId; // Filter ratings by product ID (No join, direct filter)
        getProductRatings: async (_, { productId }) => {
          return await prisma.productRating.findMany({
            where: { productId }, // SQL: WHERE productId = productId; // Filter ratings by product ID
          });
        },
      },
      // Fetch total sales for a specific product.
      // SELECT SUM(totalPrice) AS totalSales FROM sales s
      // WHERE s.productId = productId; // Filter sales by product ID (No join, direct filter)
      getTotalSalesForProduct: async (_, { productId }) => {
        const sales = await prisma.sale.aggregate({
          _sum: { totalPrice: true }, // SQL: SUM(totalPrice); // Calculate total sales amount
          where: { productId }, // SQL: WHERE productId = productId; // Filter sales by product ID
        });

        return sales._sum.totalPrice || 0; // Return total sales or 0 if no sales exist
      },
      // Get sales trends for a specific product over a date range.
      // SELECT s.soldAt, SUM(s.totalPrice) AS totalSales FROM sales s
      // WHERE s.productId = productId AND s.soldAt BETWEEN startDate AND endDate
      // GROUP BY s.soldAt ORDER BY s.soldAt ASC; // No joins involved
      getSalesTrends: async (_, { productId, startDate, endDate }) => {
        return await prisma.sale.groupBy({
          by: ["soldAt"], // SQL: GROUP BY s.soldAt; // Group sales by sold date
          where: {
            productId, // SQL: WHERE s.productId = productId; // Filter sales by product ID
            soldAt: {
              gte: startDate, // SQL: AND s.soldAt >= startDate; // Filter for sales on or after startDate
              lte: endDate, // SQL: AND s.soldAt <= endDate; // Filter for sales on or before endDate
            },
          },
          _sum: { totalPrice: true }, // SQL: SUM(s.totalPrice); // Sum the total sales for each date
          orderBy: { soldAt: "asc" }, // SQL: ORDER BY s.soldAt ASC; // Order results by sold date
        });
      },
      // Fetch products with the most feedback (reviews).
      // SELECT p.*, COUNT(r.id) AS reviewCount FROM products p
      // LEFT JOIN reviews r ON p.id = r.productId // Include reviews related to the product (Left Join)
      // GROUP BY p.id ORDER BY reviewCount DESC LIMIT limit;
      getProductsWithMostFeedback: async (_, { limit }) => {
        return await prisma.product.findMany({
          orderBy: {
            reviews: {
              _count: "desc", // SQL: ORDER BY reviewCount DESC; // Order products by review count
            },
          },
          take: limit, // SQL: LIMIT limit; // Limit the results to the specified number
        });
      },
      // Fetch products based on a user's feedback (reviews).
      // SELECT r.*, p.* FROM reviews r
      // INNER JOIN products p ON r.productId = p.id // Include product details in the response (Inner Join)
      // WHERE r.userId = userId;
      getProductsBasedOnFeedback: async (_, { userId }) => {
        return await prisma.review.findMany({
          where: { userId }, // SQL: WHERE r.userId = userId; // Filter reviews by user ID
          include: {
            product: true, // SQL: JOIN products p ON r.productId = p.id; // Include product details in the response
          },
        });
      },
      // Fetch recently sold products.
      // SELECT s.*, p.* FROM sales s
      // INNER JOIN products p ON s.productId = p.id // Include product details in the response (Inner Join)
      // ORDER BY s.soldAt DESC LIMIT limit;
      getRecentlySoldProducts: async (_, { limit }) => {
        return await prisma.sale.findMany({
          orderBy: { soldAt: "desc" }, // SQL: ORDER BY s.soldAt DESC; // Order sales by sold date
          take: limit, // SQL: LIMIT limit; // Limit the results to the specified number
          include: {
            product: true, // SQL: JOIN products p ON s.productId = p.id; // Include product details in the response
          },
        });
      },
      // Fetch the most profitable products.
      // SELECT s.productId, SUM(s.totalPrice) AS totalSales FROM sales s
      // GROUP BY s.productId // Group sales by product ID
      // ORDER BY totalSales DESC LIMIT limit;
      getMostProfitableProducts: async (_, { limit }) => {
        return await prisma.sale.groupBy({
          by: ["productId"], // SQL: GROUP BY s.productId; // Group sales by product ID
          _sum: { totalPrice: true }, // SQL: SUM(s.totalPrice); // Sum the total sales for each product
          orderBy: { _sum: { totalPrice: "desc" } }, // SQL: ORDER BY totalSales DESC; // Order products by total sales
          take: limit, // SQL: LIMIT limit; // Limit the results to the specified number
        });
      },
      // Fetch sales data for a specific user.
      // SELECT s.*, p.* FROM sales s
      // INNER JOIN products p ON s.productId = p.id
      // WHERE s.userId = userId;
      getUserSalesData: async (_, { userId }) => {
        return await prisma.sale.findMany({
          where: { userId }, // SQL: WHERE s.userId = userId; // Filter sales by user ID
          include: {
            product: true, // SQL: JOIN products p ON s.productId = p.id; // Include product details in the response
          },
        });
      },
      // Fetch stock levels for a specific product.
      // SELECT stock, quantity FROM products
      // WHERE id = productId;
      getStockLevels: async (_, { productId }) => {
        return await prisma.product.findUnique({
          where: { id: productId }, // SQL: WHERE p.id = productId; // Find product by ID
          select: {
            stock: true, // SQL: SELECT p.stock; // Select the stock level
            quantity: true, // SQL: SELECT p.quantity; // Select the quantity available
          },
        });
      },
      // Fetch sales summary for a specific product.
      // SELECT s.soldAt, SUM(s.quantity) AS totalQuantity
      // FROM sales s
      // WHERE s.productId = productId
      // GROUP BY s.soldAt
      // ORDER BY s.soldAt ASC;
      getSalesSummary: async (_, { productId }) => {
        return await prisma.sale.groupBy({
          by: ["soldAt"], // SQL: GROUP BY s.soldAt; // Group sales by sold date
          where: { productId }, // SQL: WHERE s.productId = productId; // Filter sales by product ID
          _sum: { quantity: true }, // SQL: SUM(s.quantity); // Sum the quantities sold for each date
          orderBy: { soldAt: "asc" }, // SQL: ORDER BY s.soldAt ASC; // Order results by sold date
        });
      },
      // Fetch total sales over a specified time period for a specific product.
      // SELECT COUNT(s.id) AS totalSales
      // FROM sales s
      // WHERE s.productId = productId
      // AND s.soldAt BETWEEN startDate AND endDate;
      getTotalSalesOverTime: async (_, { productId, startDate, endDate }) => {
        return await prisma.sale.aggregate({
          _count: { id: true }, // SQL: COUNT(s.id); // Count the total number of sales
          where: {
            productId, // SQL: WHERE s.productId = productId; // Filter sales by product ID
            soldAt: {
              gte: startDate, // SQL: AND s.soldAt >= startDate; // Filter for sales on or after startDate
              lte: endDate, // SQL: AND s.soldAt <= endDate; // Filter for sales on or before endDate
            },
          },
        });
      },
      // Fetch feedback summary for a specific product.
      // SELECT * FROM reviews r
      // WHERE r.productId = productId;
      getFeedbackSummary: async (_, { productId }) => {
        const reviews = await prisma.review.findMany({
          where: { productId }, // SQL: WHERE r.productId = productId; // Filter reviews by product ID
          select: { percentage: true, content: true, userId: true }, // SQL: SELECT r.percentage, r.content, r.userId; // Select relevant fields
        });

        const totalReviews = reviews.length; // SQL: COUNT(*) AS totalReviews; // Count total number of reviews
        const averageRating =
          totalReviews > 0
            ? reviews.reduce((sum, review) => sum + review.percentage, 0) /
              totalReviews // SQL: AVG(r.percentage); // Calculate average rating
            : 0;
        const feedbackSummaryPercentage =
          totalReviews > 0 ? ((averageRating / 100) * 100).toFixed(2) : 0; // Calculate feedback summary percentage
        // Categorize review content by sentiment
        const categorizedReviews = reviews.reduce(
          (acc, review) => {
            const sentiment = getSentiment(review.content); // SQL: Custom function to determine sentiment
            acc[sentiment].push(review.content); // Push review content to the appropriate category
            return acc;
          },
          {
            positive: [] as string[], // Initialize array for positive reviews
            negative: [] as string[], // Initialize array for negative reviews
            neutral: [] as string[], // Initialize array for neutral reviews
          }
        );
        return {
          totalReviews, // SQL: totalReviews; // Return total reviews count
          averageRating, // SQL: averageRating; // Return average rating
          feedbackSummaryPercentage, // SQL: feedbackSummaryPercentage; // Return feedback summary percentage
          reviewMessages: categorizedReviews, // SQL: categorizedReviews; // Return categorized reviews
        };
      },
      // Fetch reviews for a specific product.
      // SELECT * FROM reviews
      // WHERE productId = productId;
      getProductReviews: async (_, { productId }) => {
        return await prisma.review.findMany({
          where: { productId }, // SQL: WHERE productId = productId; // Filter reviews by product ID
          select: {
            percentage: true, // SQL: SELECT percentage; // Select percentage rating
            content: true, // SQL: SELECT content; // Select review content
            userId: true, // SQL: SELECT userId; // Select user ID who wrote the review
            createdAt: true, // SQL: SELECT createdAt; // Select creation date of the review
          },
        });
      },
      // Fetch user feedback rating for a specific user.
      // SELECT percentage FROM reviews
      // WHERE userId = userId;
      getUserFeedbackRating: async (_, { userId }) => {
        const reviews = await prisma.review.findMany({
          where: { userId }, // SQL: WHERE userId = userId; // Filter reviews by user ID
          select: { percentage: true }, // SQL: SELECT percentage; // Select percentage rating
        });
        // Calculate the average rating from the user's reviews
        const averageRating =
          reviews.length > 0
            ? reviews.reduce((sum, review) => sum + review.percentage, 0) /
              reviews.length // SQL: AVG(percentage);
            : 0;

        return { averageRating }; // Return the average rating
      },

      // Fetch all reviews for a specific product, including user details.
      // SELECT * FROM reviews
      // WHERE productId = productId;
      getAllReviews: async (_, { productId }) => {
        return await prisma.review.findMany({
          where: { productId }, // SQL: WHERE productId = productId; // Filter reviews by product ID
          include: {
            user: { select: { username: true, profilePicture: true } }, // SQL: LEFT JOIN users ON reviews.userId = users.id; // Include user details (username and profile picture)
          },
        });
      },
      // Fetch reviews written by a specific user, including product details.
      // SELECT * FROM reviews
      // WHERE userId = userId;
      getReviewsByUser: async (_, { userId }) => {
        return await prisma.review.findMany({
          where: { userId }, // SQL: WHERE userId = userId; // Filter reviews by user ID
          include: { product: { select: { title: true } } }, // SQL: LEFT JOIN products ON reviews.productId = products.id; // Include product details (title)
        });
      },
      // Fetch review statistics for a specific product.
      // SELECT * FROM reviews
      // WHERE productId = productId;
      getReviewStats: async (_, { productId }) => {
        const reviews = await prisma.review.findMany({ where: { productId } }); // SQL: WHERE productId = productId; // Fetch reviews for the product
        const reviewCount = reviews.length; // SQL: COUNT(*) AS reviewCount; // Count total number of reviews
        const averageRating =
          reviewCount > 0
            ? reviews.reduce((sum, review) => sum + review.percentage, 0) /
              reviewCount // SQL: AVG(percentage);
            : 0;

        return { reviewCount, averageRating }; // Return review count and average rating
      },
      // Fetch the 5 most recent reviews for a specific product.
      // SELECT * FROM reviews
      // WHERE productId = productId
      // ORDER BY createdAt
      // DESC LIMIT 5;
      getRecentFeedbackAndReviews: async (_, { productId }) => {
        const reviews = await prisma.review.findMany({
          where: { productId }, // SQL: WHERE productId = productId; // Filter reviews by product ID
          orderBy: { createdAt: "desc" }, // SQL: ORDER BY createdAt DESC; // Order results by creation date
          take: 5, // SQL: LIMIT 5; // Limit to the 5 most recent reviews
        });
        return { reviews }; // Return the recent reviews
      },
      // Fetch average rating for a specific user.
      // SQL:
      // SELECT percentage FROM reviews
      // WHERE userId = userId;
      getUserAverageRating: async (_, { userId }) => {
        const reviews = await prisma.review.findMany({ where: { userId } }); // SQL: WHERE userId = userId; // Fetch reviews for the user
        const averageRating =
          reviews.length > 0
            ? reviews.reduce((sum, review) => sum + review.percentage, 0) /
              reviews.length // SQL: AVG(percentage);
            : 0;
        return { userId, averageRating }; // Return user ID and average rating
      },
      // Fetch top-rated products based on reviews.
      // SQL:
      // SELECT * FROM products
      // LEFT JOIN reviews ON products.id = reviews.productId;
      getTopRatedProducts: async () => {
        const products = await prisma.product.findMany({
          include: {
            reviews: true, // SQL: Include reviews to calculate average
          },
        });
        return products
          .map((product) => ({
            ...product,
            averageRating:
              product.reviews.length > 0
                ? product.reviews.reduce(
                    (sum, review) => sum + review.percentage,
                    0
                  ) / product.reviews.length // SQL: AVG(percentage);
                : 0,
          }))
          .sort((a, b) => b.averageRating - a.averageRating); // SQL: ORDER BY averageRating DESC; // Sort by average rating
      },
      // Fetch top selling products.
      // SQL:
      // SELECT * FROM products
      // LEFT JOIN sales ON products.id = sales.productId
      // ORDER BY salesCount DESC
      // LIMIT 10;
      getTopSellingProducts: async () => {
        return await prisma.product.findMany({
          include: { sales: true }, // SQL: Include sales data
          orderBy: { sales: { _count: "desc" } }, // SQL: ORDER BY salesCount DESC; // Order by sales count
          take: 10, // SQL: LIMIT 10; // Limit to top 10 products
        });
      },
      // Fetch product availability details.
      // SQL:
      // SELECT stock, quantity, status
      // FROM products
      // WHERE id = productId;
      getProductAvailability: async (_, { productId }) => {
        const product = await prisma.product.findUnique({
          where: { id: productId }, // SQL: WHERE id = productId; // Find product by ID
          select: { stock: true, quantity: true, status: true }, // SQL: SELECT stock, quantity, status; // Select availability details
        });
        return product; // Return product availability details
      },
      // Fetch all products that have active raffles.
      // SQL:
      // SELECT * FROM products
      // LEFT JOIN raffles ON products.id = raffles.productId
      // WHERE hasRaffle = true;
      getAllProductsWithRaffles: async () => {
        return await prisma.product.findMany({
          where: { hasRaffle: true }, // SQL: WHERE hasRaffle = true; // Filter products with active raffles
          include: {
            raffles: true, // SQL LEFT JOIN: LEFT JOIN raffles ON products.id = raffles.productId; // Include associated raffle details
          },
        });
      },
      // Fetch all raffles for a specific product by its ID.
      // SQL:
      // SELECT * FROM raffles
      // WHERE productId = {productId};
      getRafflesForProduct: async (
        _: unknown,
        { productId }: { productId: number }
      ) => {
        return await prisma.raffle.findMany({
          where: { productId }, // SQL: WHERE productId = productId; // Filter raffles by product ID
          include: {
            entries: true, // SQL LEFT JOIN: LEFT JOIN raffleEntries ON raffles.id = raffleEntries.raffleId; // Include entries for the raffle
          },
        });
      },
      // Fetch details for a specific raffle by its ID.
      // SQL:
      // SELECT * FROM raffles
      // LEFT JOIN products ON raffles.productId = products.id
      // LEFT JOIN raffleEntries ON raffles.id = raffleEntries.raffleId
      // WHERE id = {raffleId};
      getRaffleDetails: async (
        _: unknown,
        { raffleId }: { raffleId: number }
      ) => {
        return await prisma.raffle.findUnique({
          where: { id: raffleId }, // SQL: WHERE id = raffleId; // Find raffle by ID
          include: {
            product: true, // SQL INNER JOIN: INNER JOIN products ON raffles.productId = products.id; // Include the product details
            entries: true, // SQL LEFT JOIN: LEFT JOIN raffleEntries ON raffles.id = raffleEntries.raffleId; // Include entries for the raffle
          },
        });
      },
      // Fetch all active (open) raffles.
      // SQL:
      // SELECT * FROM raffles
      // LEFT JOIN products ON raffles.productId = products.id
      // WHERE status = 'OPEN';
      getActiveRaffles: async () => {
        return await prisma.raffle.findMany({
          where: { status: "OPEN" }, // SQL: WHERE status = 'OPEN'; // Filter for open raffles
          include: {
            product: true, // SQL INNER JOIN: INNER JOIN products ON raffles.productId = products.id; // Include the product details
          },
        });
      },
      // Fetch all closed raffles.
      // SQL:
      // SELECT * FROM raffles
      // LEFT JOIN products ON raffles.productId = products.id
      // WHERE status = 'CLOSED';
      getClosedRaffles: async () => {
        return await prisma.raffle.findMany({
          where: { status: "CLOSED" }, // SQL: WHERE status = 'CLOSED'; // Filter for closed raffles
          include: {
            product: true, // SQL INNER JOIN: INNER JOIN products ON raffles.productId = products.id; // Include the product details
          },
        });
      },
      // Fetch all canceled raffles.
      // SQL:
      // SELECT * FROM raffles
      // LEFT JOIN products ON raffles.productId = products.id
      // WHERE status = 'CANCELED';
      getCanceledRaffles: async () => {
        return await prisma.raffle.findMany({
          where: { status: "CANCELED" }, // SQL: WHERE status = 'CANCELED'; // Filter for canceled raffles
          include: {
            product: true, // SQL INNER JOIN: INNER JOIN products ON raffles.productId = products.id; // Include the product details
          },
        });
      },
      // Fetch all raffle entries for a specific user by their user ID.
      // SQL:
      // SELECT * FROM raffleEntries
      // LEFT JOIN raffles ON raffleEntries.raffleId = raffles.id
      // LEFT JOIN products ON raffles.productId = products.id
      // WHERE userId = {userId};
      getUsersRaffleEntries: async (
        _: unknown,
        { userId }: { userId: number }
      ) => {
        return await prisma.raffleEntry.findMany({
          where: { userId }, // SQL: WHERE userId = userId; // Filter entries by user ID
          include: {
            raffle: { include: { product: true } }, // SQL JOIN: JOIN raffles ON raffleEntries.raffleId = raffles.id;
            // SQL JOIN: JOIN products ON raffles.productId = products.id; // Include raffle and associated product details
          },
        });
      },

      // Fetch raffles filtered by their type.
      // SQL:
      // SELECT * FROM raffles
      // LEFT JOIN products ON raffles.productId = products.id
      // WHERE type = {raffleType};
      getRafflesByType: async (
        _: unknown,
        { raffleType }: { raffleType: RaffleType }
      ) => {
        return await prisma.raffle.findMany({
          where: { type: raffleType }, // SQL: WHERE type = raffleType; // Filter raffles by type
          include: {
            product: true, // SQL INNER JOIN: INNER JOIN products ON raffles.productId = products.id; // Include associated product details
          },
        });
      },
      // Fetch winners of a specific raffle.
      // SQL:
      // SELECT * FROM raffleEntries
      // LEFT JOIN users ON raffleEntries.userId = users.id
      // WHERE raffleId = {raffleId} AND result = 'WON';
      getRaffleWinners: async (
        _: unknown,
        { raffleId }: { raffleId: number }
      ) => {
        return await prisma.raffleEntry.findMany({
          where: { raffleId, result: "WON" }, // SQL: WHERE raffleId = raffleId AND result = 'WON'; // Filter winners by raffle ID
          include: {
            user: true, // SQL LEFT JOIN: LEFT JOIN users ON raffleEntries.userId = users.id; // Include user details
          },
        });
      },
      // Fetch losers of a specific raffle.
      // SQL:
      // SELECT * FROM raffleEntries
      // LEFT JOIN users ON raffleEntries.userId = users.id
      // WHERE raffleId = {raffleId} AND result = 'LOST';
      getRaffleLosers: async (
        _: unknown,
        { raffleId }: { raffleId: number }
      ) => {
        return await prisma.raffleEntry.findMany({
          where: { raffleId, result: "LOST" }, // SQL: WHERE raffleId = raffleId AND result = 'LOST'; // Filter losers by raffle ID
          include: {
            user: true, // SQL LEFT JOIN: LEFT JOIN users ON raffleEntries.userId = users.id; // Include user details
          },
        });
      },
      // Fetch statistics for a specific raffle.
      // SQL:
      // SELECT * FROM raffles
      // LEFT JOIN raffleEntries ON raffles.id = raffleEntries.raffleId
      // WHERE id = {raffleId};
      getRaffleStatistics: async (
        _: unknown,
        { raffleId }: { raffleId: number }
      ) => {
        const raffle = await prisma.raffle.findUnique({
          where: { id: raffleId }, // SQL: WHERE id = raffleId; // Find raffle by ID
          include: {
            entries: true, // SQL LEFT JOIN: LEFT JOIN raffleEntries ON raffles.id = raffleEntries.raffleId; // Get all entries to calculate stats
          },
        });
        const totalEntries = raffle?.entries.length || 0; // Calculate total entries
        return {
          totalEntries, // Return total entries
          raffle, // Return raffle details
        };
      },
      // Fetch raffle entries filtered by result status.
      // SQL:
      // SELECT * FROM raffleEntries
      // LEFT JOIN users ON raffleEntries.userId = users.id
      // WHERE raffleId = {raffleId} AND result = {result};
      getEntriesByResult: async (
        _: unknown,
        { raffleId, result }: { raffleId: number; result: RaffleResult }
      ) => {
        return await prisma.raffleEntry.findMany({
          where: { raffleId, result }, // SQL: WHERE raffleId = raffleId AND result = result; // Filter entries by raffle ID and result
          include: {
            user: true, // SQL LEFT JOIN: LEFT JOIN users ON raffleEntries.userId = users.id; // Include user details
          },
        });
      },
      // Fetch raffles for a specific user based on their entries.
      // SQL:
      // SELECT * FROM raffles r
      // LEFT JOIN raffleEntries re ON r.id = re.raffleId
      // WHERE re.userId = {userId};
      getRafflesForUser: async (_: unknown, { userId }: { userId: number }) => {
        return await prisma.raffle.findMany({
          where: {
            entries: {
              some: {
                userId, // SQL: WHERE userId = userId; // Filter raffles where user has entries
              },
            },
          },
          include: {
            entries: true, // SQL LEFT JOIN: LEFT JOIN raffleEntries ON raffles.id = raffleEntries.raffleId; // Include entries for each raffle
            product: true, // SQL INNER JOIN: INNER JOIN products ON raffles.productId = products.id; // Include associated product details
          },
        });
      },
      // Fetch raffles for a specific product.
      // SQL:
      // SELECT * FROM raffles
      // WHERE productId = {productId};
      getRafflesByProduct: async (
        _: unknown,
        { productId }: { productId: number }
      ) => {
        return await prisma.raffle.findMany({
          where: { productId }, // SQL: WHERE productId = productId; // Filter raffles by product ID
          include: {
            entries: true, // SQL LEFT JOIN: LEFT JOIN raffleEntries ON raffles.id = raffleEntries.raffleId; // Include all entries for the raffle
          },
        });
      },
      // Fetch recent raffles with a limit.
      // SQL:
      // SELECT * FROM raffles
      // LEFT JOIN products ON raffles.productId = products.id
      // ORDER BY createdAt DESC
      // LIMIT {limit};
      getRecentRaffles: async (_: unknown, { limit }: { limit: number }) => {
        return await prisma.raffle.findMany({
          orderBy: { createdAt: "desc" }, // SQL: ORDER BY createdAt DESC; // Order by creation date
          take: limit, // SQL: LIMIT {limit}; // Limit to the specified number of recent raffles
          include: {
            product: true, // SQL INNER JOIN: INNER JOIN products ON raffles.productId = products.id; // Include associated product details
          },
        });
      },
      // Fetch user's raffle history by user ID.
      // SQL:
      // SELECT * FROM raffleEntries
      // LEFT JOIN raffles ON raffleEntries.raffleId = raffles.id
      // LEFT JOIN products ON raffles.productId = products.id
      // WHERE userId = {userId};
      getUsersRaffleHistory: async (
        _: unknown,
        { userId }: { userId: number }
      ) => {
        return await prisma.raffleEntry.findMany({
          where: { userId }, // SQL: WHERE userId = userId; // Filter entries by user ID
          include: {
            raffle: { include: { product: true } }, // SQL JOIN: JOIN raffles ON raffleEntries.raffleId = raffles.id;
            // SQL JOIN: JOIN products ON raffles.productId = products.id; // Include raffle and associated product details
          },
        });
      },
      // Fetch countdown details for a specific raffle.
      // SQL:
      // SELECT * FROM raffles
      // WHERE id = {raffleId};
      getRaffleCountdown: async (
        _: unknown,
        { raffleId }: { raffleId: number }
      ) => {
        const raffle = await prisma.raffle.findUnique({
          where: { id: raffleId }, // SQL: WHERE id = raffleId; // Find raffle by ID
          select: {
            id: true,
            title: true,
            endsAt: true, // SQL: SELECT endsAt; // Select ending time for countdown
          },
        });
        if (!raffle) {
          throw new Error("Raffle not found"); // Handle case where raffle does not exist
        }
        const timeRemaining = new Date(raffle.endsAt).getTime() - Date.now(); // Calculate time remaining
        return {
          ...raffle, // Return raffle details
          timeRemaining, // Return remaining time
        };
      },
      // Fetch the count of entries for a specific raffle.
      // SQL:
      // SELECT COUNT(*) FROM raffleEntries
      // WHERE raffleId = {raffleId};
      getRaffleEntryCount: async (
        _: unknown,
        { raffleId }: { raffleId: number }
      ) => {
        const entries = await prisma.raffleEntry.count({
          where: { raffleId }, // SQL: WHERE raffleId = raffleId; // Count entries for the raffle
        });
        return { totalEntries: entries }; // Return total entry count
      },
      // Fetch raffles that are ending soon.
      // SQL:
      // SELECT * FROM raffles
      // LEFT JOIN products ON raffles.productId = products.id
      // WHERE endsAt > NOW()
      // ORDER BY endsAt ASC
      // LIMIT {limit};
      getRafflesEndingSoon: async (
        _: unknown,
        { limit }: { limit: number }
      ) => {
        return await prisma.raffle.findMany({
          where: {
            endsAt: {
              gt: new Date(), // SQL: WHERE endsAt > NOW(); // Filter for raffles that are still open
            },
          },
          orderBy: { endsAt: "asc" }, // SQL: ORDER BY endsAt ASC; // Order by ending date
          take: limit, // SQL: LIMIT {limit}; // Limit to the specified number of soon-ending raffles
          include: {
            product: true, // SQL INNER JOIN: INNER JOIN products ON raffles.productId = products.id; // Include associated product details
          },
        });
      },
      // SQL:
      // SELECT COUNT(*) FROM raffleEntries
      // WHERE userId = {userId}
      // AND result = 'WON';
      // SQL:
      // SELECT COUNT(*) FROM raffleEntries
      // WHERE userId = {userId};
      getUserWinningPercentage: async (
        _: unknown,
        { userId }: { userId: number }
      ) => {
        const totalEntries = await prisma.raffleEntry.count({
          where: { userId }, // SQL: WHERE userId = userId; // Count total entries for the user
        });
        const totalWins = await prisma.raffleEntry.count({
          where: { userId, result: "WON" }, // SQL: WHERE userId = userId AND result = 'WON'; // Count wins for the user
        });
        const winningPercentage =
          totalEntries > 0 ? (totalWins / totalEntries) * 100 : 0;
        return { winningPercentage }; // Return winning percentage
      },
      // SQL:
      // SELECT * FROM raffleEntries
      // WHERE result = 'WON'
      // AND createdAt BETWEEN {startDate} AND {endDate};
      getRaffleWinnersByDateRange: async (
        _: unknown,
        { startDate, endDate }: { startDate: Date; endDate: Date }
      ) => {
        return await prisma.raffleEntry.findMany({
          where: {
            result: "WON", // SQL: WHERE result = 'WON'; // Filter for winning entries
            createdAt: {
              gte: startDate, // SQL: WHERE createdAt >= startDate; // Filter for entries after startDate
              lte: endDate, // SQL: WHERE createdAt <= endDate; // Filter for entries before endDate
            },
          },
          include: {
            user: true, // SQL JOIN: JOIN users ON raffleEntries.userId = users.id; // Include user details
            raffle: true, // SQL JOIN: JOIN raffles ON raffleEntries.raffleId = raffles.id; // Include raffle details
          },
        });
      },
      // SQL:
      // SELECT * FROM raffles
      // WHERE id NOT IN (SELECT DISTINCT raffleId FROM raffleEntries);
      getRafflesWithNoEntries: async () => {
        return await prisma.raffle.findMany({
          where: {
            NOT: {
              entries: {
                some: {}, // SQL: WHERE entries IS EMPTY; // Filter raffles with no entries
              },
            },
          },
          include: {
            product: true, // SQL JOIN: JOIN products ON raffles.productId = products.id; // Include associated product details
          },
        });
      },
      // Fetch all entries for a specific raffle with user details.
      // SQL:
      // SELECT * FROM raffleEntries
      // WHERE raffleId = {raffleId};
      getRaffleEntriesWithUsers: async (
        _: unknown,
        { raffleId }: { raffleId: number }
      ) => {
        return await prisma.raffleEntry.findMany({
          where: { raffleId }, // SQL: WHERE raffleId = raffleId; // Filter entries by raffle ID
          include: {
            user: true, // SQL JOIN: JOIN users ON raffleEntries.userId = users.id; // Include user details
          },
        });
      },
      // Fetch raffle details with entry statistics.
      getRaffleDetailsWithStatistics: async (
        _: unknown,
        { raffleId }: { raffleId: number }
      ) => {
        const raffle = await prisma.raffle.findUnique({
          where: { id: raffleId }, // SQL: WHERE id = raffleId; // Find raffle by ID
          include: {
            entries: true, // SQL JOIN: JOIN raffleEntries ON raffles.id = raffleEntries.raffleId; // Include all entries
          },
        });

        const totalEntries = raffle?.entries.length || 0; // Count total entries
        const totalWinners =
          raffle?.entries.filter((entry) => entry.result === "WON").length || 0; // Count total winners

        return {
          ...raffle,
          totalEntries,
          totalWinners,
        };
      },
      // Fetch active raffles filtered by type.
      getActiveRafflesByType: async (
        _: unknown,
        { type }: { type: RaffleType }
      ) => {
        return await prisma.raffle.findMany({
          where: {
            status: "OPEN", // SQL: WHERE status = 'OPEN'; // Filter for active raffles
            type, // SQL: WHERE type = type; // Filter by raffle type
          },
          include: {
            product: true, // SQL JOIN: JOIN products ON raffles.productId = products.id; // Include product details
          },
        });
      },
      // Fetch all raffles with no winners.
      getRafflesWithNoWinners: async () => {
        return await prisma.raffle.findMany({
          where: {
            entries: {
              none: {
                result: "WON", // SQL: WHERE result != 'WON'; // Filter raffles with no winning entries
              },
            },
          },
          include: {
            product: true, // SQL JOIN: JOIN products ON raffles.productId = products.id; // Include associated product details
          },
        });
      },
      // Fetch winners of a specific raffle categorized by raffle type.
      // SQL:
      // SELECT * FROM raffleEntries
      // WHERE raffleId = {raffleId}
      // AND result = 'WON';
      getRaffleWinnersByRaffleType: async (
        _: unknown,
        { raffleId }: { raffleId: number }
      ) => {
        const raffle = await prisma.raffle.findUnique({
          where: { id: raffleId }, // SQL: WHERE id = raffleId; // Find raffle by ID
          include: {
            entries: {
              where: { result: "WON" }, // SQL: WHERE result = 'WON'; // Filter winning entries
              include: {
                user: true, // SQL JOIN: JOIN users ON raffleEntries.userId = users.id; // Include user details
              },
            },
          },
        });
        return {
          raffleId,
          raffleType: raffle?.type, // Get the type of the raffle
          winners: raffle?.entries || [], // Winners of the raffle
        };
      },
      // Fetch statistics of winners categorized by raffle type.
      // SQL:
      // SELECT * FROM raffleEntries
      // WHERE result = 'WON';
      getWinningStatisticsByType: async () => {
        // Fetch all winners
        const winners = await prisma.raffleEntry.findMany({
          where: { result: "WON" }, // SQL: WHERE result = 'WON'; // Filter winning entries
          include: {
            raffle: {
              select: {
                type: true, // Get the raffle type
                id: true, // You may want to include the raffle ID for reference
              },
            },
          },
        });

        // Process the data to count winners by type
        const statistics = winners.reduce((acc, entry) => {
          const raffleType = entry.raffle.type;
          acc[raffleType] = (acc[raffleType] || 0) + 1; // Count winners by type
          return acc;
        }, {} as Record<RaffleType, number>);

        return statistics; // Return the statistics by raffle type
      },
      // Fetch raffle history for a specific user.
      // SQL:
      // SELECT * FROM raffleEntries
      // WHERE userId = {userId};
      getRaffleHistoryForUser: async (
        _: unknown,
        { userId }: { userId: number }
      ) => {
        return await prisma.raffleEntry.findMany({
          where: { userId }, // SQL: WHERE userId = userId; // Filter entries by user ID
          include: {
            raffle: { include: { product: true } }, // SQL JOIN: JOIN raffles ON raffleEntries.raffleId = raffles.id;
            // SQL JOIN: JOIN products ON raffles.productId = products.id; // Include raffle and product details
          },
        });
      },
      // Fetch upcoming raffles.
      getUpcomingRaffles: async () => {
        // SQL: SELECT * FROM raffles
        // WHERE status = 'OPEN'
        // AND endsAt > NOW();
        const upcomingRaffles = await prisma.raffle.findMany({
          where: {
            // Filter for raffles that are currently open
            status: "OPEN", // SQL: WHERE status = 'OPEN';

            // Filter for raffles that have not ended yet
            endsAt: {
              gt: new Date(), // SQL: WHERE endsAt > NOW();
            },
          },
          orderBy: {
            // Order by the ending date in ascending order
            endsAt: "asc", // SQL: ORDER BY endsAt ASC;
          },
          include: {
            // Include associated product details in the results
            product: true, // SQL JOIN: JOIN products ON raffles.productId = products.id;
          },
        });
        // Return the list of upcoming raffles
        return upcomingRaffles; // Return the upcoming raffles
      },
      // Fetch finished raffles.
      getFinishedRaffles: async () => {
        // Get the current date and time
        const now = new Date();

        // SQL: SELECT * FROM raffles
        // WHERE endsAt < NOW();
        return await prisma.raffle.findMany({
          where: {
            // Filter for raffles that have already ended
            endsAt: { lt: now }, // Corrected property name
          },
          orderBy: {
            // Order by the ending date in descending order
            endsAt: "desc", // Corrected property name
          },
        });
      },
      // Fetch raffles entered by a specific user.
      getUserEnteredRaffles: async (userId: number) => {
        // SQL: SELECT * FROM raffleEntries
        // WHERE userId = {userId};
        return await prisma.raffleEntry.findMany({
          where: {
            // Filter for entries associated with the given user ID
            userId, // Use the userId argument correctly
          },
          include: {
            // Include raffle details for each entry
            raffle: true, // Include raffle details
          },
        });
      },
      // Fetch raffles within a specific date range.
      getRafflesByDateRange: async (
        _: unknown,
        { startDate, endDate }: { startDate: Date; endDate: Date }
      ) => {
        // SQL: SELECT * FROM raffles
        // WHERE createdAt BETWEEN {startDate} AND {endDate};
        return await prisma.raffle.findMany({
          where: {
            createdAt: {
              // Filter for raffles created on or after the start date
              gte: startDate, // SQL: WHERE createdAt >= {startDate}
              // Filter for raffles created on or before the end date
              lte: endDate, // SQL: WHERE createdAt <= {endDate}
            },
          },
          include: {
            // Include associated product details in the results
            product: true, // SQL JOIN: JOIN products ON raffles.productId = products.id;
          },
        });
      },
      // Fetch entries for a specific user, along with raffle details.
      getUserEntriesWithRaffleStatus: async (
        _: unknown,
        { userId }: { userId: number }
      ) => {
        // SQL: SELECT * FROM raffleEntries
        // WHERE userId = {userId};
        return await prisma.raffleEntry.findMany({
          where: {
            userId, // Filter for entries associated with the given user ID
          },
          include: {
            // Include details of the associated raffle
            raffle: {
              include: {
                // Include product details for the associated raffle
                product: true,
              },
            },
          },
        });
      },
      // Fetch recent winners of raffles.
      getRecentWinners: async () => {
        // SQL: SELECT * FROM raffleEntries
        // WHERE result = 'WON'
        // ORDER BY createdAt DESC
        return await prisma.raffleEntry.findMany({
          where: { result: "WON" }, // Filter for entries with a winning result
          orderBy: { createdAt: "desc" }, // Order by creation date, newest first
          include: {
            // Include details of the user and the associated raffle
            user: true,
            raffle: {
              include: { product: true }, // Include product details for the raffle
            },
          },
          take: 10, // Limit results to the 10 most recent winners
        });
      },
      // Fetch raffles that have a minimum number of entries.
      getRafflesByMinEntryCount: async (
        _: unknown,
        { minEntries }: { minEntries: number }
      ) => {
        // SQL: SELECT * FROM raffles
        // JOIN entries ON raffles.id = entries.raffleId
        const raffles = await prisma.raffle.findMany({
          include: {
            _count: {
              select: { entries: true }, // Count the number of entries for each raffle
            },
            product: true, // Include product details for each raffle
          },
        });
        // Filter raffles based on the minimum entry count
        return raffles.filter((raffle) => raffle._count.entries >= minEntries);
      },
      // Calculate the participation rate of a specific user.
      getUserParticipationRate: async (
        _: unknown,
        { userId }: { userId: number }
      ) => {
        // SQL: SELECT COUNT(*) FROM raffles;
        const totalRaffles = await prisma.raffle.count();

        // SQL: SELECT COUNT(*) FROM raffleEntries WHERE userId = {userId};
        const userEntries = await prisma.raffleEntry.count({
          where: { userId }, // Count entries associated with the given user ID
        });

        // Calculate participation rate as a percentage
        const participationRate =
          totalRaffles > 0 ? (userEntries / totalRaffles) * 100 : 0;

        // Return the calculated participation rate
        return { participationRate };
      },
      // Fetch a user's winning streak based on their winning entries.
      getUsersWinningStreak: async (
        _: unknown,
        { userId }: { userId: number }
      ) => {
        // SQL: SELECT * FROM raffleEntries
        // WHERE userId = {userId} AND result = 'WON';
        return await prisma.raffleEntry.findMany({
          where: {
            userId, // Filter for entries by the specified user
            result: "WON", // Filter for winning entries
          },
          orderBy: { createdAt: "desc" }, // Order by creation date, newest first
        });
      },
      // Fetch the most entered raffles by a specific user.
      getMostEnteredRafflesForUser: async (
        _: unknown,
        { userId }: { userId: number }
      ) => {
        // SQL: SELECT raffleId, COUNT(*) FROM raffleEntries
        // WHERE userId = {userId}
        // GROUP BY raffleId
        return await prisma.raffleEntry.groupBy({
          by: ["raffleId"], // Group entries by raffle ID
          where: { userId }, // Filter for entries by the specified user
          _count: {
            raffleId: true, // Count the number of entries per raffle
          },
          orderBy: {
            _count: {
              raffleId: "desc", // Order by entry count, highest first
            },
          },
        });
      },
      // Fetch raffles ordered by entry count.
      getRafflesOrderedByEntryCount: async () => {
        // SQL: SELECT * FROM raffles
        // JOIN entries ON raffles.id = entries.raffleId
        const raffles = await prisma.raffle.findMany({
          include: {
            _count: {
              select: { entries: true }, // Include the count of entries for each raffle
            },
          },
        });

        // Sort raffles by the count of entries in descending order
        return raffles.sort((a, b) => b._count.entries - a._count.entries);
      },
      // Fetch popular raffles based on entry count, limited by a specified amount.
      getPopularRaffles: async (_: unknown, { limit }: { limit: number }) => {
        // SQL: SELECT * FROM raffles
        // JOIN entries ON raffles.id = entries.raffleId
        const raffles = await prisma.raffle.findMany({
          include: {
            product: true, // Include product details for each raffle
            _count: {
              select: { entries: true }, // Include the count of entries
            },
          },
        });

        // Sort the raffles by entry count in descending order and limit the results
        return raffles
          .sort((a, b) => b._count.entries - a._count.entries) // Sort by entry count
          .slice(0, limit); // Limit to the specified number of popular raffles
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
