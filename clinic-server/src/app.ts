import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import patientRoutes from "./routes/patient.routes";
import departmentRoutes from "./routes/department.routes";
import roomRoutes from "./routes/room.routes";
import serviceRoutes from "./routes/service.routes";
import locationRoutes from "./routes/location.routes";
import roleRoutes from "./routes/role.routes";
import positionRoutes from "./routes/position.routes";
import titleRoutes from "./routes/title.routes";
import medicalRecordRoutes from "./routes/medical-record.routes";
import medicalExaminationRoutes from "./routes/medical-examination.routes";
import diseaseRoutes from "./routes/disease.routes";
import serviceGroupRoutes from "./routes/serviceGroup.routes";
import serviceTypeRoutes from "./routes/serviceType.routes";
import occupationRoutes from "./routes/occupation.routes";
import serviceOrderRoutes from "./routes/serviceOrder.routes";
import resultRoutes from "./routes/result.routes";
import invoiceRoutes from "./routes/invoice.routes";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: [
        'http://localhost:3000', // production frontend
        'http://localhost:5173', // local Vite dev server
    ],
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    credentials: true
}))

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/department", departmentRoutes);
app.use("/api/room", roomRoutes);
app.use("/api/service", serviceRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/role", roleRoutes);
app.use("/api/position", positionRoutes);
app.use("/api/title", titleRoutes);
app.use("/api/occupation", occupationRoutes);
app.use("/api/medical-record", medicalRecordRoutes);
app.use("/api/medical-examination", medicalExaminationRoutes);
app.use("/api/disease", diseaseRoutes);
app.use("/api/service-group", serviceGroupRoutes);
app.use("/api/service-type", serviceTypeRoutes);
app.use("/api/service-order", serviceOrderRoutes);
app.use("/api/result", resultRoutes);
app.use("/api/invoice", invoiceRoutes);

app.use(errorHandler);

export default app;