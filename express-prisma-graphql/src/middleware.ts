import jwt from "jsonwebtoken";

export const authMiddleware = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, "secret-key");
      req.user = decoded;
    } catch (err) {
      req.user = null;
    }
  }

  next();
};
//чтобы заглядывал в бд и возвращал ошибки
//проверка нет пользователя(404 и 403)
