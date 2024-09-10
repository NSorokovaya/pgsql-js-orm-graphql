import { readFileSync } from "node:fs";
import path from "node:path";

import express from "express";
import { ApolloServer } from "apollo-server-express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const typeDefs = readFileSync(path.join(__dirname, "schema.graphql"), "utf8");

const resolvers = {
  Query: {
    users: () =>
      prisma.users.findMany({
        include: { posts: true },
      }),
    user: (_parent: any, args: { id: string }) =>
      prisma.users.findUnique({ where: { id: args.id } }),
    chats: (_parent: any, args: { id: string }) => prisma.chats.findMany(),
    posts: () => prisma.posts.findMany(),
    post: (_parent: any, args: { id: string }) =>
      prisma.posts.findUnique({ where: { id: args.id } }),
  },
  Mutation: {
    createUser: (_parent: any, args: { username: string; password: string }) =>
      prisma.users.create({ data: args }),
    createPost: async (
      _parent: any,
      args: { userId: string; title: string; content: string }
    ) => {
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
  },
};

async function startApolloServer() {
  const app = express();

  const server = new ApolloServer({ typeDefs, resolvers });

  await server.start();

  // @ts-ignore
  server.applyMiddleware({ app });

  app.listen({ port: 4000 }, () =>
    console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
  );
}

startApolloServer();
