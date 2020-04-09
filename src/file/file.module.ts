import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { IntentModule } from "../intent/intent.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { ResponseModule } from "../response/response.module";

@Module({
  controllers: [FileController],
  providers: [FileService],
  imports: [
    IntentModule,
    KnowledgeModule,
    ResponseModule
  ]
})
export class FileModule {}
