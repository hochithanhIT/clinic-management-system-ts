import app from "./app";
import appConfig from "./config/app.config";
import ensureAdminAccount from "./setup/ensureAdminAccount";

const startServer = async () => {
  await ensureAdminAccount();

  app.listen(appConfig.port, () => {
    console.log(`Server running on port ${appConfig.port}`);
  });
};

void startServer();