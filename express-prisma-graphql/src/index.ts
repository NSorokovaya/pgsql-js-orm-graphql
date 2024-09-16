import { readFileSync } from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";

import express from "express";
import { ApolloServer } from "apollo-server-express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "./middleware";
import { Context } from "node:vm";

const prisma = new PrismaClient();

const typeDefs = readFileSync(path.join(__dirname, "schema.graphql"), "utf8");

const resolvers = {
  Query: {
    users: async (
      _parent: any,
      args: { first?: number; after?: string; last?: number; before?: string },
      context: Context
    ) => {
      // if (!context.user) throw new Error("Not authorized");
      const { first = 10, after } = args;

      const users = await prisma.users.findMany({
        take: first + 1,
        skip: after ? 1 : 0,
        cursor: after ? { id: after } : undefined,
        orderBy: { id: "asc" },
        include: { posts: true },
      });
      const hasNextPage = users.length > first;
      const edges = users.slice(0, first).map((user) => ({
        node: user,
        cursor: user.id,
      }));
      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: Boolean(after),
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
      };
    },
    user: async (_parent: any, args: { id: string }, context: Context) => {
      // if (!context.user) throw new Error("Not authorized");
      const user = await prisma.users.findUnique({
        where: { id: args.id },
        select: {
          username: true,
          is_admin: true,
          created_at: true,
        },
      });
      if (!user) throw new Error("User hasn't been found");
      return {
        username: user.username,
        isAdmin: user.is_admin,
        createdAt: user.created_at,
      };
    },

    chats: (_parent: any, args: { id: string }, context: Context) => {
      // if (!context.user) throw new Error("Not authorized");
      return prisma.chats.findMany();
    },
    posts: (context: Context) => {
      // if (!context.user) throw new Error("Not authorized");
      return prisma.posts.findMany();
    },
    post: (_parent: any, args: { id: string }, context: Context) => {
      // if (!context.user) throw new Error("Not authorized");
      return prisma.posts.findUnique({
        where: { id: args.id },
        include: { users: true },
      });
    },
  },
  Post: {
    user: async (post: any, _: any, context: Context) => {
      // if (!context.user) throw new Error("Not authorized");

      return await prisma.users.findUnique({
        where: { id: post.user_id },
        include: { posts: true },
      });
    },
  },
  User: {
    posts: async (user: any, _: any) => {
      // if (!context.user) throw new Error("Not authorized");

      return await prisma.posts.findMany({
        where: {
          user_id: user.id,
        },
      });
    },
    postCount: async (user: any) => {
      return await prisma.posts.count({ where: { user_id: user.id } });
    },
    commentsCount: async (user: any) => {
      return await prisma.comments.count({ where: { user_id: user.id } });
    },
    reactionsCount: async (user: any) => {
      return await prisma.reactions_to_posts.count({
        where: { user_id: user.id },
      });
    },
    postViewsCount: async (user: any) => {
      return await prisma.post_views.count({ where: { user_id: user.id } });
    },
    friends: async (user: any) => {
      const friendRequests = await prisma.friend_requests.findMany({
        where: {
          OR: [
            { receiver_id: user.id, status: "accepted" },
            { requester_id: user.id, status: "accepted" },
          ],
        },
      });
      const friendIds = friendRequests.map((request) =>
        request.receiver_id === user.id
          ? request.requester_id
          : request.receiver_id
      );

      const friends = await prisma.users.findMany({
        where: { id: { in: friendIds } },
        select: { id: true, username: true },
      });
      return friends;
    },
    followees: async (user: any) => {
      const followees = await prisma.follow_requests.findMany({
        where: { follower_id: user.id, status: "accepted" },
      });
      return await prisma.users.findMany({
        where: { id: { in: followees.map((f) => f.followee_id) } },
      });
    },
    followers: async (user: any) => {
      const followers = await prisma.follow_requests.findMany({
        where: { followee_id: user.id, status: "accepted" },
      });
      return await prisma.users.findMany({
        where: { id: { in: followers.map((f) => f.follower_id) } },
      });
    },
  },
  Mutation: {
    createUser: (
      _parent: any,
      args: { username: string; password: string }
    ) => {
      return prisma.users.create({ data: args });
    },
    createPost: async (
      _parent: any,
      args: { userId: string; title: string; content: string },
      context: Context
    ) => {
      // if (!context.user) throw new Error("Not authorized");
      const post = await prisma.posts.create({
        data: {
          title: args.title,
          content: args.content,
          user_id: args.userId,
        },
      });

      return {
        userId: post.user_id,
        title: post.title,
        content: post.content,
      };
    },
    login: async (
      _parent: any,
      args: { username: string; password: string }
    ) => {
      const user = await prisma.users.findFirst({
        where: { username: args.username },
      });
      if (!user || user.password !== args.password) {
        throw new Error("Password is wrong");
      }
      const token = jwt.sign({ userId: user.id }, "secret-key", {
        expiresIn: "12h",
      });
      return { token, user };
    },
    deleteUser: async (_parent: any, arg: { id: string }) => {
      const user = await prisma.users.findUnique({
        where: { id: arg.id },
      });

      if (!user) {
        throw new Error("User not found");
      }
      await prisma.users.delete({
        where: { id: arg.id },
      });
      return user;
    },
  },
};

async function startApolloServer() {
  const app = express();
  // app.use(authMiddleware);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    // context: ({ req }) => {
    //   // @ts-ignore
    //   return { user: req.user };
    // },
  });

  await server.start();

  // @ts-ignore
  server.applyMiddleware({ app });

  app.listen({ port: 4000 }, () =>
    console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
  );
}

startApolloServer();
