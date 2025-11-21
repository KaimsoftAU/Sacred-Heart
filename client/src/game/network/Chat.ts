import type { Socket } from 'socket.io-client';

export class ChatNetwork {
    private socket: Socket;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    public sendMessage(message: string): void {
        this.socket.emit('message', message);
    }

    public onPlayerMessage(callback: (data: any) => void): void {
        this.socket.on('playerMessage', callback);
    }

    public offPlayerMessage(): void {
        this.socket.off('playerMessage');
    }
}
