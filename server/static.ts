import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  const indexPath = path.resolve(distPath, "index.html");

  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  app.use("/{*path}", (_req, res) => {
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).type("text/html").send(
        "<!DOCTYPE html><html><head><title>App</title></head><body><p>Application is running.</p></body></html>"
      );
    }
  });
}
