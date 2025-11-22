import { Schema, model, Document } from 'mongoose';

interface IPlayer extends Document {
  username: string;
  email: string;
  password: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
  };
  skills: {
    woodcutting: {
      level: number;
      xp: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const PlayerSchema = new Schema<IPlayer>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    position: {
      x: {
        type: Number,
        default: 0
      },
      y: {
        type: Number,
        default: 0
      },
      z: {
        type: Number,
        default: 0
      }
    },
    rotation: {
      x: {
        type: Number,
        default: 0
      },
      y: {
        type: Number,
        default: 0
      },
      z: {
        type: Number,
        default: 0
      }
    },
    skills: {
      woodcutting: {
        level: {
          type: Number,
          default: 1,
          min: 1,
          max: 20
        },
        xp: {
          type: Number,
          default: 0,
          min: 0
        }
      }
    }
  },
  {
    timestamps: true
  }
);

export const Player = model<IPlayer>('Player', PlayerSchema);
export type { IPlayer };
