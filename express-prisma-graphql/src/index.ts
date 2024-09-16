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
    users: (context: Context) => {
      if (!context.user) throw new Error("Not authorized");
      prisma.users.findMany({
        include: { posts: true },
      });
    },
    user: (_parent: any, args: { id: string }, context: Context) => {
      if (!context.user) throw new Error("Not authorized");
      prisma.users.findUnique({ where: { id: args.id } });
    },

    chats: (_parent: any, args: { id: string }, context: Context) => {
      if (!context.user) throw new Error("Not authorized");
      prisma.chats.findMany();
    },
    posts: (context: Context) => {
      if (!context.user) throw new Error("Not authorized");
      prisma.posts.findMany();
    },
    post: (_parent: any, args: { id: string }, context: Context) => {
      if (!context.user) throw new Error("Not authorized");
      prisma.posts.findUnique({
        where: { id: args.id },
        include: { users: true },
      });
    },
  },
  Post: {
    user: async (post: any, _: any, context: Context) => {
      if (!context.user) throw new Error("Not authorized");

      return await prisma.users.findUnique({
        where: { id: post.user_id },
        include: { posts: true },
      });
    },
  },
  User: {
    posts: async (
      user: any,
      _: any,
      { parent }: { parent: any },
      context: Context
    ) => {
      if (!context.user) throw new Error("Not authorized");

      return await prisma.posts.findMany({
        where: {
          user_id: user.id,
        },
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
      if (!context.user) throw new Error("Not authorized");
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
  },
};

async function startApolloServer() {
  const app = express();
  app.use(authMiddleware);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      // @ts-ignore
      return { user: req.user };
    },
  });

  await server.start();

  // @ts-ignore
  server.applyMiddleware({ app });

  app.listen({ port: 4000 }, () =>
    console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
  );
}

startApolloServer();
